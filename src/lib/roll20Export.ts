import type { CharacterRecord } from "../types/character";
import type { AttributeKey, GameData } from "../types/gameData";
import {
  findCampaign,
  findClassInCampaign,
  findRaceInCampaign,
  resolveCampaignAssets,
  validateCharacterReferences,
} from "./domain";

const MAX_SKILL_ROWS = 12;
const MAX_ATTACK_ROWS = 8;
const MAX_POWER_ROWS = 12;
const MAX_INVENTORY_ROWS = 20;

export type Roll20ModRepeatingRow = {
  rowId: string;
  attributes: Record<string, string>;
};

export type Roll20ModPayload = {
  kind: "character-builder.roll20-mod-import";
  version: 1;
  character: {
    id: string;
    name: string;
    campaignId: string;
    classId: string;
    raceId: string;
    level: number;
  };
  attributes: Record<string, string>;
  hp: {
    current: string;
    max: string;
    temp: string;
    hitDie: string;
    hitDiceTotal: string;
  };
  repeating: {
    skills: Roll20ModRepeatingRow[];
    attacks: Roll20ModRepeatingRow[];
    powers: Roll20ModRepeatingRow[];
    inventory: Roll20ModRepeatingRow[];
  };
};

const LEGACY_SHEET_DEFAULTS = {
  acBase: 10,
  acBonus: 0,
  acUseDex: true,
  speed: "",
  initMisc: 0,
  saveProf: {
    STR: false,
    DEX: false,
    CON: false,
    INT: false,
    WIS: false,
    CHA: false,
  } as Record<AttributeKey, boolean>,
  saveBonus: {
    STR: 0,
    DEX: 0,
    CON: 0,
    INT: 0,
    WIS: 0,
    CHA: 0,
  } as Record<AttributeKey, number>,
};

type ExportContext = {
  campaign: ReturnType<typeof findCampaign>;
  cls: ReturnType<typeof findClassInCampaign>;
  race: ReturnType<typeof findRaceInCampaign>;
  skillMap: Map<string, { id: string; name: string; attribute: AttributeKey }>;
  powerMap: Map<string, { id: string; name: string; description?: string; usesPerDay?: number; saveAttribute?: AttributeKey }>;
  itemMap: Map<string, { id: string; name: string; description?: string }>;
  invalidSkillIdSet: Set<string>;
  invalidPowerIdSet: Set<string>;
  invalidItemIdSet: Set<string>;
  invalidAttackTemplateIdSet: Set<string>;
  campaignPowerIds: Set<string>;
};

function getEffectiveSheetState(character: CharacterRecord) {
  return {
    acBase: Number.isFinite(character.sheet?.acBase)
      ? Number(character.sheet.acBase)
      : LEGACY_SHEET_DEFAULTS.acBase,
    acBonus: Number.isFinite(character.sheet?.acBonus)
      ? Number(character.sheet.acBonus)
      : LEGACY_SHEET_DEFAULTS.acBonus,
    acUseDex:
      typeof character.sheet?.acUseDex === "boolean"
        ? character.sheet.acUseDex
        : LEGACY_SHEET_DEFAULTS.acUseDex,
    speed: character.sheet?.speed ?? LEGACY_SHEET_DEFAULTS.speed,
    initMisc: Number.isFinite(character.sheet?.initMisc)
      ? Number(character.sheet.initMisc)
      : LEGACY_SHEET_DEFAULTS.initMisc,
    saveProf: {
      STR: Boolean(character.sheet?.saveProf?.STR),
      DEX: Boolean(character.sheet?.saveProf?.DEX),
      CON: Boolean(character.sheet?.saveProf?.CON),
      INT: Boolean(character.sheet?.saveProf?.INT),
      WIS: Boolean(character.sheet?.saveProf?.WIS),
      CHA: Boolean(character.sheet?.saveProf?.CHA),
    } as Record<AttributeKey, boolean>,
    saveBonus: {
      STR: Number(character.sheet?.saveBonus?.STR ?? LEGACY_SHEET_DEFAULTS.saveBonus.STR),
      DEX: Number(character.sheet?.saveBonus?.DEX ?? LEGACY_SHEET_DEFAULTS.saveBonus.DEX),
      CON: Number(character.sheet?.saveBonus?.CON ?? LEGACY_SHEET_DEFAULTS.saveBonus.CON),
      INT: Number(character.sheet?.saveBonus?.INT ?? LEGACY_SHEET_DEFAULTS.saveBonus.INT),
      WIS: Number(character.sheet?.saveBonus?.WIS ?? LEGACY_SHEET_DEFAULTS.saveBonus.WIS),
      CHA: Number(character.sheet?.saveBonus?.CHA ?? LEGACY_SHEET_DEFAULTS.saveBonus.CHA),
    } as Record<AttributeKey, number>,
  };
}

function buildExportContext(character: CharacterRecord, gameData: GameData): ExportContext {
  const campaign = findCampaign(gameData, character.campaignId);
  const cls = findClassInCampaign(campaign, character.classId);
  const race = findRaceInCampaign(campaign, character.raceId ?? "");
  const assets = resolveCampaignAssets(campaign);
  const referenceValidation = validateCharacterReferences(character, campaign);

  return {
    campaign,
    cls,
    race,
    skillMap: new Map(assets.skills.map((skill) => [skill.id, skill])),
    powerMap: new Map(assets.powers.map((power) => [power.id, power])),
    itemMap: new Map(assets.items.map((item) => [item.id, item])),
    invalidSkillIdSet: new Set(referenceValidation.invalidSkillIds),
    invalidPowerIdSet: new Set(referenceValidation.invalidPowerIds),
    invalidItemIdSet: new Set(referenceValidation.invalidItemIds),
    invalidAttackTemplateIdSet: new Set(referenceValidation.invalidAttackTemplateIds),
    campaignPowerIds: new Set(assets.powers.map((power) => power.id)),
  };
}

function getExportedSkills(character: CharacterRecord) {
  const gainedSkillIds = new Set(character.levelProgression?.gainedSkillIds ?? []);
  return character.skills.filter(
    (skill) => skill.proficient || gainedSkillIds.has(skill.skillId)
  );
}

function getExportedPowers(
  character: CharacterRecord,
  gamePowerIds: Set<string>,
  powerMap: Map<string, { id: string; name: string; description?: string; usesPerDay?: number; saveAttribute?: AttributeKey }>
) {
  const existingPowerIds = new Set(character.powers.map((power) => power.powerId).filter(Boolean));
  const gainedPowerIds = (character.levelProgression?.gainedPowerIds ?? []).filter(
    (powerId) => gamePowerIds.has(powerId)
  );

  const missingGainedPowers = gainedPowerIds
    .filter((powerId) => !existingPowerIds.has(powerId))
    .map((powerId) => {
      const definition = powerMap.get(powerId);
      return {
        powerId,
        name: definition?.name ?? powerId,
        notes: definition?.description ?? "",
        source: "level-up" as const,
        usesPerDay: definition?.usesPerDay,
        description: definition?.description,
        saveAttribute: definition?.saveAttribute,
      };
    });

  return [...character.powers, ...missingGainedPowers];
}

function clean(value: string | number | boolean | undefined | null) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\r?\n/g, " ").trim();
}

function getModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function getThemeValue(campaignId: string) {
  const normalized = campaignId.toLowerCase();
  if (normalized.includes("scifi") || normalized.includes("sci-fi")) return "scifi";
  if (normalized.includes("horror")) return "horror";
  if (normalized.includes("modern")) return "modern";
  if (normalized.includes("pulp")) return "pulp";
  return "fantasy";
}

function getSaveAttributeValue(attribute?: AttributeKey): string {
  if (!attribute) return "none";
  const attrLower = attribute.toLowerCase();
  return `${attrLower}_mod`;
}

function hashFnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function makeStableRepeatingRowId(section: string, seed: string, used: Set<string>): string {
  let attempt = 0;
  while (true) {
    const suffix = hashFnv1a(`${section}:${seed}:${attempt}`);
    const rowId = `cb${suffix}`;
    if (!used.has(rowId)) {
      used.add(rowId);
      return rowId;
    }
    attempt += 1;
  }
}

function buildOccurrenceSeed(baseSeed: string, countsBySeed: Map<string, number>): string {
  const nextCount = (countsBySeed.get(baseSeed) ?? 0) + 1;
  countsBySeed.set(baseSeed, nextCount);
  return `${baseSeed}#${nextCount}`;
}

type ExportCollectionLimits = {
  maxSkills?: number;
  maxAttacks?: number;
  maxPowers?: number;
  maxInventory?: number;
  allowInvalidReferences?: boolean;
};

export function buildRoll20AttributeMap(
  character: CharacterRecord,
  gameData: GameData
): Record<string, string> {
  const context = buildExportContext(character, gameData);
  const sheet = getEffectiveSheetState(character);
  const exported = getFilteredExportCollections(character, context, {
    maxSkills: MAX_SKILL_ROWS,
    maxAttacks: MAX_ATTACK_ROWS,
    maxPowers: MAX_POWER_ROWS,
    maxInventory: MAX_INVENTORY_ROWS,
  });

  const result: Record<string, string> = {};

  function setRepeatingValue(sectionName: string, rowId: string, fieldName: string, value: string) {
    result[`repeating_${sectionName}_${rowId}_${fieldName}`] = value;
  }

  // Header / top section
  result["attr_character_name"] = clean(character.identity.name);
  result["attr_class"] = clean(context.cls?.name ?? character.classId);
  result["attr_race"] = clean(context.race?.name ?? character.raceId ?? "");
  result["attr_sheet_theme"] = clean(getThemeValue(character.campaignId));

  // Core stats
  result["attr_level"] = clean(character.level);
  result["attr_pb"] = clean(character.proficiencyBonus);

  // Sheet/core state with legacy defaults for older saved records.
  result["attr_ac_base"] = clean(sheet.acBase);
  result["attr_ac_bonus"] = clean(sheet.acBonus);
  // This sheet's worker uses parseInt(ac_use_dex), so it must be numeric.
  result["attr_ac_use_dex"] = sheet.acUseDex ? "1" : "0";
  result["attr_speed"] = clean(sheet.speed);

  // HP
  const maxHp = clean(character.hp.max);
  const currentHp = clean(character.hp.current);
  // Keep explicit keys first for this sheet.
  result["attr_hp_max"] = maxHp;
  result["attr_hp_current"] = currentHp;
  result["attr_hp_temp"] = clean(character.hp.temp ?? 0);
  result["attr_hit_die"] = clean(character.hp.hitDie ?? context.cls?.hpRule.hitDie ?? 0);
  result["attr_hit_dice_total"] = clean(character.levelProgression?.totalHitDice ?? character.level);

  // Attributes
  result["attr_str"] = clean(character.attributes.STR);
  result["attr_dex"] = clean(character.attributes.DEX);
  result["attr_con"] = clean(character.attributes.CON);
  result["attr_int"] = clean(character.attributes.INT);
  result["attr_wis"] = clean(character.attributes.WIS);
  result["attr_cha"] = clean(character.attributes.CHA);

  // Derived mods
  result["attr_str_mod"] = clean(getModifier(character.attributes.STR));
  result["attr_dex_mod"] = clean(getModifier(character.attributes.DEX));
  result["attr_con_mod"] = clean(getModifier(character.attributes.CON));
  result["attr_int_mod"] = clean(getModifier(character.attributes.INT));
  result["attr_wis_mod"] = clean(getModifier(character.attributes.WIS));
  result["attr_cha_mod"] = clean(getModifier(character.attributes.CHA));

  // Saving throw state from modeled character sheet fields.
  const saveAttrs: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  for (const attr of saveAttrs) {
    const lower = attr.toLowerCase();
    result[`attr_${lower}_saveprof`] = sheet.saveProf[attr] ? "1" : "";
    result[`attr_${lower}_savebonus`] = clean(sheet.saveBonus[attr]);
    result[`attr_${lower}_save_total`] = clean(
      getModifier(character.attributes[attr]) + sheet.saveBonus[attr]
    );
  }

  // AC / initiative derived fields
  result["attr_ac"] = clean(
    sheet.acBase + sheet.acBonus + (sheet.acUseDex ? getModifier(character.attributes.DEX) : 0)
  );
  result["attr_init_misc"] = clean(sheet.initMisc);
  result["attr_initiative"] = clean(getModifier(character.attributes.DEX) + sheet.initMisc);

  // Repeating skills
  for (let i = 0; i < exported.skills.length; i++) {
    const rowId = `$${i}`;
    const skill = exported.skills[i];
    const definition = context.skillMap.get(skill.skillId);
    const attr = definition?.attribute ?? "STR";

    const skillName = clean(definition?.name ?? skill.skillId);
    const skillAttr = clean(getModifier(character.attributes[attr]));
    const skillProf = clean(character.proficiencyBonus);
    const skillBonus = clean(skill.bonus ?? 0);

    setRepeatingValue("skills", rowId, "skillname", skillName);
    setRepeatingValue("skills", rowId, "skillattr", skillAttr);
    setRepeatingValue("skills", rowId, "skillprof", skillProf);
    setRepeatingValue("skills", rowId, "skillbonus", skillBonus);
  }

  // Repeating attacks
  for (let i = 0; i < exported.attacks.length; i++) {
    const rowId = `$${i}`;
    const attack = exported.attacks[i];

    const attackName = clean(attack.name);
    const attackAttr = clean(getModifier(character.attributes[attack.attribute]));
    const attackProf = clean(character.proficiencyBonus);
    const attackBonus = clean(attack.bonus ?? 0);
    const damageDice = clean(attack.damage);

    setRepeatingValue("attacks", rowId, "attackname", attackName);
    setRepeatingValue("attacks", rowId, "attackattr", attackAttr);
    setRepeatingValue("attacks", rowId, "attackprof", attackProf);
    setRepeatingValue("attacks", rowId, "attackbonus", attackBonus);
    setRepeatingValue("attacks", rowId, "damagedice", damageDice);
    setRepeatingValue("attacks", rowId, "damagebonus", "0");
  }

  // Repeating powers
  for (let i = 0; i < exported.powers.length; i++) {
    const rowId = `$${i}`;
    const power = exported.powers[i];
    const definition = power.powerId ? context.powerMap.get(power.powerId) : undefined;
    const notes = clean(power.notes ?? definition?.description ?? "");
    const text = notes ? `${power.name} - ${notes}` : power.name;
    const powerText = clean(text);

    setRepeatingValue("powers", rowId, "powertext", powerText);
  }

  // Repeating inventory
  for (let i = 0; i < exported.inventory.length; i++) {
    const rowId = `$${i}`;
    const item = exported.inventory[i];
    const definition = item.itemId ? context.itemMap.get(item.itemId) : undefined;

    const itemName = clean(item.name);
    const itemQty = clean(item.quantity);
    const itemNotes = clean(item.notes ?? definition?.description ?? "");

    setRepeatingValue("inventory", rowId, "itemname", itemName);
    setRepeatingValue("inventory", rowId, "itemqty", itemQty);
    setRepeatingValue("inventory", rowId, "itemnotes", itemNotes);
  }

  return result;
}

export function buildRoll20ModPayload(
  character: CharacterRecord,
  gameData: GameData
): Roll20ModPayload {
  const context = buildExportContext(character, gameData);
  const exported = getFilteredExportCollections(character, context, {
    allowInvalidReferences: true,
  });
  const map = buildRoll20AttributeMap(character, gameData);

  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(map)) {
    if (key.startsWith("repeating_")) continue;
    const attrName = key.startsWith("attr_") ? key.slice(5) : key;
    attributes[attrName] = value;
  }

  const hp = {
    current: clean(character.hp.current),
    max: clean(character.hp.max),
    temp: clean(character.hp.temp ?? 0),
    hitDie: clean(character.hp.hitDie ?? context.cls?.hpRule.hitDie ?? 0),
    hitDiceTotal: clean(character.levelProgression?.totalHitDice ?? character.level),
  };

  attributes.hp_current = hp.current;
  attributes.hp_max = hp.max;
  attributes.hp_temp = hp.temp;
  attributes.hit_die = hp.hitDie;
  attributes.hit_dice_total = hp.hitDiceTotal;

  const usedSkillIds = new Set<string>();
  const usedAttackIds = new Set<string>();
  const usedPowerIds = new Set<string>();
  const usedInventoryIds = new Set<string>();

  const skillSeedCounts = new Map<string, number>();
  const attackSeedCounts = new Map<string, number>();
  const powerSeedCounts = new Map<string, number>();
  const inventorySeedCounts = new Map<string, number>();

  const skills: Roll20ModRepeatingRow[] = exported.skills.map((skill) => {
    const definition = context.skillMap.get(skill.skillId);
    const attr = definition?.attribute ?? "STR";
    const baseSeed = `skill:${skill.skillId}:${skill.source}`;
    const seed = buildOccurrenceSeed(baseSeed, skillSeedCounts);
    const rowId = makeStableRepeatingRowId("skills", seed, usedSkillIds);
    return {
      rowId,
      attributes: {
        skillname: clean(definition?.name ?? skill.skillId),
        skillattr: clean(getSaveAttributeValue(attr)),
        skillprof: "1",
        skillbonus: clean(skill.bonus ?? 0),
      },
    };
  });

  const attacks: Roll20ModRepeatingRow[] = exported.attacks.map((attack) => {
    const baseSeed = `attack:${attack.id}`;
    const seed = buildOccurrenceSeed(baseSeed, attackSeedCounts);
    const rowId = makeStableRepeatingRowId("attacks", seed, usedAttackIds);
    return {
      rowId,
      attributes: {
        attackname: clean(attack.name),
        attackattr: clean(getSaveAttributeValue(attack.attribute)),
        attackprof: "1",
        attackbonus: clean(attack.bonus ?? 0),
        damagedice: clean(attack.damage),
        damagebonus: clean(attack.damageBonus ?? 0),
      },
    };
  });

  const powers: Roll20ModRepeatingRow[] = exported.powers.map((power) => {
    const definition = power.powerId ? context.powerMap.get(power.powerId) : undefined;
    const usesPerDay = power.usesPerDay ?? definition?.usesPerDay ?? 0;
    const saveAttribute = power.saveAttribute ?? definition?.saveAttribute;
    const description = power.description ?? definition?.description ?? power.notes ?? "";
    const baseSeed = `power:${power.powerId ?? power.name}:${power.source}`;
    const seed = buildOccurrenceSeed(baseSeed, powerSeedCounts);
    const rowId = makeStableRepeatingRowId("powers", seed, usedPowerIds);

    return {
      rowId,
      attributes: {
        powername: clean(power.name),
        power_uses: clean(usesPerDay),
        power_save_attr: clean(getSaveAttributeValue(saveAttribute)),
        powertext: clean(description),
      },
    };
  });

  const inventory: Roll20ModRepeatingRow[] = exported.inventory.map((item) => {
    const definition = item.itemId ? context.itemMap.get(item.itemId) : undefined;
    const baseSeed = `inventory:${item.itemId ?? item.name}:${item.source}`;
    const seed = buildOccurrenceSeed(baseSeed, inventorySeedCounts);
    const rowId = makeStableRepeatingRowId("inventory", seed, usedInventoryIds);

    return {
      rowId,
      attributes: {
        itemname: clean(item.name),
        itemqty: clean(item.quantity),
        itemnotes: clean(item.notes ?? definition?.description ?? ""),
      },
    };
  });

  return {
    kind: "character-builder.roll20-mod-import",
    version: 1,
    character: {
      id: character.id,
      name: clean(character.identity.name),
      campaignId: character.campaignId,
      classId: character.classId,
      raceId: character.raceId ?? "",
      level: character.level,
    },
    attributes,
    hp,
    repeating: {
      skills,
      attacks,
      powers,
      inventory,
    },
  };
}

export function buildRoll20ModPayloadJson(character: CharacterRecord, gameData: GameData): string {
  return JSON.stringify(buildRoll20ModPayload(character, gameData), null, 2);
}

export function buildRoll20ModImportCommand(
  character: CharacterRecord,
  gameData: GameData
): string {
  const compactPayload = JSON.stringify(buildRoll20ModPayload(character, gameData));
  return `!cb-import ${compactPayload}`;
}

function getFilteredExportCollections(
  character: CharacterRecord,
  context: ExportContext,
  limits: ExportCollectionLimits = {}
) {
  const allowInvalidReferences = Boolean(limits.allowInvalidReferences);

  const skills = getExportedSkills(character)
    .filter((skill) => allowInvalidReferences || !context.invalidSkillIdSet.has(skill.skillId))
    .slice(0, limits.maxSkills ?? Number.POSITIVE_INFINITY);

  const powers = getExportedPowers(character, context.campaignPowerIds, context.powerMap)
    .filter((power) => allowInvalidReferences || !context.invalidPowerIdSet.has(power.powerId ?? ""))
    .slice(0, limits.maxPowers ?? Number.POSITIVE_INFINITY);

  const inventory = character.inventory
    .filter((item) => allowInvalidReferences || !context.invalidItemIdSet.has(item.itemId ?? ""))
    .slice(0, limits.maxInventory ?? Number.POSITIVE_INFINITY);

  const attacks = character.attacks
    .filter(
      (attack) =>
        allowInvalidReferences ||
        // Only drop derived (power/item) attacks whose source has been removed.
        // Manually-referenced template attacks are kept even if the template is stale.
        !attack.derivedFromType ||
        !attack.derivedFromId ||
        !context.invalidAttackTemplateIdSet.has(attack.templateId ?? "")
    )
    .filter((attack) => attack.name.trim() !== "")
    .slice(0, limits.maxAttacks ?? Number.POSITIVE_INFINITY);

  return { skills, powers, inventory, attacks };
}

export function buildChatSetAttrCommand(character: CharacterRecord, gameData: GameData): string {
  return buildChatSetAttrPhases(character, gameData).combined;
}

export function buildChatSetAttrPhases(
  character: CharacterRecord,
  gameData: GameData
): { phase1: string; phase2: string; combined: string } {
  const map = buildRoll20AttributeMap(character, gameData);
  const context = buildExportContext(character, gameData);
  const exported = getFilteredExportCollections(character, context, {
    maxSkills: MAX_SKILL_ROWS,
    maxAttacks: MAX_ATTACK_ROWS,
    maxPowers: MAX_POWER_ROWS,
    maxInventory: MAX_INVENTORY_ROWS,
  });
  const setPrefix = "!setattr --replace --sel";
  const delPrefix = "!delattr --mute --sel";
  const maxCommandLength = 1700;

  const inlineRefValues: Record<string, string> = {
    pb: clean(character.proficiencyBonus),
    str_mod: clean(getModifier(character.attributes.STR)),
    dex_mod: clean(getModifier(character.attributes.DEX)),
    con_mod: clean(getModifier(character.attributes.CON)),
    int_mod: clean(getModifier(character.attributes.INT)),
    wis_mod: clean(getModifier(character.attributes.WIS)),
    cha_mod: clean(getModifier(character.attributes.CHA)),
  };

  function resolveInlineRefs(value: string) {
    return value
      .replace(/@\{([a-z_]+)\}/gi, (_full, key: string) => {
        const normalized = key.toLowerCase();
        return inlineRefValues[normalized] ?? "0";
      })
      .trim();
  }

  function escapeForChatSetAttr(value: string) {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\|/g, "&#124;")
      .replace(/--/g, "&#45;&#45;")
      .replace(/\n/g, " ");
  }

  function makePair(attrName: string, rawValue: string | number) {
    const resolvedValue = resolveInlineRefs(String(rawValue));
    const safeValue = escapeForChatSetAttr(resolvedValue);
    return `--${attrName}|'${safeValue}'`;
  }

  function chunkCommands(prefix: string, parts: string[]) {
    const commands: string[] = [];
    if (parts.length === 0) return commands;

    let current = prefix;
    for (const part of parts) {
      const next = `${current} ${part}`;
      if (next.length > maxCommandLength && current !== prefix) {
        commands.push(current);
        current = `${prefix} ${part}`;
      } else {
        current = next;
      }
    }

    if (current !== prefix) {
      commands.push(current);
    }

    return commands;
  }

  // Base non-repeating attributes.
  const basePairsByName = new Map<string, string>();
  for (const [key, value] of Object.entries(map)) {
    if (value === "" || key.startsWith("repeating_")) continue;
    const attrName = key.startsWith("attr_") ? key.slice(5) : key;
    basePairsByName.set(attrName, makePair(attrName, value));
  }
  // Guarantee explicit HP values are present.
  basePairsByName.set("hp_max", makePair("hp_max", clean(character.hp.max)));
  basePairsByName.set("hp_current", makePair("hp_current", clean(character.hp.current)));
  basePairsByName.set("hp_temp", makePair("hp_temp", clean(character.hp.temp ?? 0)));
  basePairsByName.set("hit_die", makePair("hit_die", clean(character.hp.hitDie ?? 0)));
  basePairsByName.set(
    "hit_dice_total",
    makePair("hit_dice_total", clean(character.levelProgression?.totalHitDice ?? character.level))
  );

  const baseCommands = chunkCommands(setPrefix, [...basePairsByName.values()]);
  const repeatingCommands: string[] = [];

  // Clear existing repeating rows first so reruns are idempotent and do not duplicate entries.
  const repeatingDeleteParts: string[] = [];
  for (let i = 0; i < MAX_SKILL_ROWS; i++) {
    repeatingDeleteParts.push(`--repeating_skills_$${i}`);
  }
  for (let i = 0; i < MAX_ATTACK_ROWS; i++) {
    repeatingDeleteParts.push(`--repeating_attacks_$${i}`);
  }
  for (let i = 0; i < MAX_POWER_ROWS; i++) {
    repeatingDeleteParts.push(`--repeating_powers_$${i}`);
  }
  for (let i = 0; i < MAX_INVENTORY_ROWS; i++) {
    repeatingDeleteParts.push(`--repeating_inventory_$${i}`);
  }
  repeatingCommands.push(...chunkCommands(delPrefix, repeatingDeleteParts));

  // Repeating skills.
  for (const skill of exported.skills) {
    const def = context.skillMap.get(skill.skillId);
    const attr = def?.attribute ?? "STR";
    repeatingCommands.push(
      `${setPrefix} ${[
        makePair("repeating_skills_-CREATE_skillname", clean(def?.name ?? skill.skillId)),
        makePair("repeating_skills_-CREATE_skillattr", clean(getModifier(character.attributes[attr]))),
        makePair("repeating_skills_-CREATE_skillprof", clean(character.proficiencyBonus)),
        makePair("repeating_skills_-CREATE_skillbonus", clean(skill.bonus ?? 0)),
      ].join(" ")}`
    );
  }

  // Repeating attacks.
  for (const attack of exported.attacks) {
    repeatingCommands.push(
      `${setPrefix} ${[
        makePair("repeating_attacks_-CREATE_attackname", clean(attack.name)),
        makePair("repeating_attacks_-CREATE_attackattr", clean(getModifier(character.attributes[attack.attribute]))),
        makePair("repeating_attacks_-CREATE_attackprof", clean(character.proficiencyBonus)),
        makePair("repeating_attacks_-CREATE_attackbonus", clean(attack.bonus ?? 0)),
        makePair("repeating_attacks_-CREATE_damagedice", clean(attack.damage)),
        makePair("repeating_attacks_-CREATE_damagebonus", "0"),
      ].join(" ")}`
    );
  }

  // Repeating powers.
  for (const power of exported.powers) {
    const definition = power.powerId ? context.powerMap.get(power.powerId) : undefined;
    const usesPerDay = power.usesPerDay ?? definition?.usesPerDay ?? 0;
    const saveAttribute = power.saveAttribute ?? definition?.saveAttribute;
    const description = power.description ?? definition?.description ?? "";
    repeatingCommands.push(
      `${setPrefix} ${[
        makePair("repeating_powers_-CREATE_powername", clean(power.name)),
        makePair("repeating_powers_-CREATE_power_uses", clean(usesPerDay)),
        makePair("repeating_powers_-CREATE_power_save_attr", getSaveAttributeValue(saveAttribute)),
        makePair("repeating_powers_-CREATE_powertext", clean(description)),
      ].join(" ")}`
    );
  }

  // Repeating inventory.
  for (const item of exported.inventory) {
    repeatingCommands.push(
      `${setPrefix} ${[
        makePair("repeating_inventory_-CREATE_itemname", clean(item.name)),
        makePair("repeating_inventory_-CREATE_itemqty", clean(item.quantity)),
        makePair("repeating_inventory_-CREATE_itemnotes", clean(item.notes ?? "")),
      ].join(" ")}`
    );
  }

  // Final touch can help the sheet UI repaint consistently after repeating updates.
  // This sheet expects max HP via --hp||<max> (empty current, explicit max).
  const finalHpCommand = `${setPrefix} --hp||'${escapeForChatSetAttr(clean(character.hp.max))}'`;

  const phase1Commands = [...baseCommands, finalHpCommand];
  // Some Roll20/API runs drop a few repeating updates on the first pass.
  // Keep Phase 2 idempotent by running the same clear+recreate sequence twice.
  const phase2Commands = [...repeatingCommands, ...repeatingCommands];
  const phase1 = phase1Commands.join("\n");
  const phase2 = phase2Commands.join("\n");
  const combined = [...phase1Commands, ...phase2Commands].join("\n");

  return { phase1, phase2, combined };
}