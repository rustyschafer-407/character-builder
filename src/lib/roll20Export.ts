import type { CharacterRecord } from "../types/character";
import type { AttributeKey, GameData } from "../types/gameData";

const MAX_SKILL_ROWS = 12;
const MAX_ATTACK_ROWS = 8;
const MAX_POWER_ROWS = 12;
const MAX_INVENTORY_ROWS = 20;

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

export function buildRoll20AttributeMap(
  character: CharacterRecord,
  gameData: GameData
): Record<string, string> {
  const campaign = gameData.campaigns.find((campaign) => campaign.id === character.campaignId);
  const cls = campaign?.classes.find((c) => c.id === character.classId);

  const skillMap = new Map((campaign?.skills ?? []).map((skill) => [skill.id, skill]));
  const powerMap = new Map((campaign?.powers ?? []).map((power) => [power.id, power]));
  const itemMap = new Map((campaign?.items ?? []).map((item) => [item.id, item]));

  const result: Record<string, string> = {};

  function setRepeatingValue(sectionName: string, rowId: string, fieldName: string, value: string) {
    result[`repeating_${sectionName}_${rowId}_${fieldName}`] = value;
  }

  // Header / top section
  result["attr_character_name"] = clean(character.identity.name);
  result["attr_class_race"] = clean(cls?.name ?? character.classId);
  result["attr_sheet_theme"] = clean(getThemeValue(character.campaignId));

  // Core stats
  result["attr_level"] = clean(character.level);
  result["attr_pb"] = clean(character.proficiencyBonus);

  // These are not modeled yet in your builder, so export safe defaults/blanks
  result["attr_ac_base"] = "10";
  result["attr_ac_bonus"] = "0";
  // This sheet's worker uses parseInt(ac_use_dex), so it must be numeric.
  result["attr_ac_use_dex"] = "1";
  result["attr_speed"] = "";

  // HP
  const maxHp = clean(character.hp.max);
  const currentHp = clean(character.hp.current);
  // Keep explicit keys first for this sheet.
  result["attr_hp_max"] = maxHp;
  result["attr_hp_current"] = currentHp;

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

  // Save profs/bonuses/totals are not modeled separately in your app yet
  const saveAttrs: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  for (const attr of saveAttrs) {
    const lower = attr.toLowerCase();
    result[`attr_${lower}_saveprof`] = "";
    result[`attr_${lower}_savebonus`] = "0";
    result[`attr_${lower}_save_total`] = clean(getModifier(character.attributes[attr]));
  }

  // AC / initiative derived fields
  result["attr_ac"] = clean(10 + getModifier(character.attributes.DEX));
  result["attr_init_misc"] = "0";
  result["attr_initiative"] = clean(getModifier(character.attributes.DEX));

  // Repeating skills
  const proficientSkills = character.skills
    .filter((skill) => skill.proficient)
    .slice(0, MAX_SKILL_ROWS);

  for (let i = 0; i < proficientSkills.length; i++) {
    const rowId = `$${i}`;
    const skill = proficientSkills[i];
    const definition = skillMap.get(skill.skillId);
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
  const exportedAttacks = character.attacks.slice(0, MAX_ATTACK_ROWS);

  for (let i = 0; i < exportedAttacks.length; i++) {
    const rowId = `$${i}`;
    const attack = exportedAttacks[i];

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
  const exportedPowers = character.powers.slice(0, MAX_POWER_ROWS);

  for (let i = 0; i < exportedPowers.length; i++) {
    const rowId = `$${i}`;
    const power = exportedPowers[i];
    const definition = power.powerId ? powerMap.get(power.powerId) : undefined;
    const notes = clean(power.notes ?? definition?.description ?? "");
    const text = notes ? `${power.name} - ${notes}` : power.name;
    const powerText = clean(text);

    setRepeatingValue("powers", rowId, "powertext", powerText);
  }

  // Repeating inventory
  const exportedInventory = character.inventory.slice(0, MAX_INVENTORY_ROWS);

  for (let i = 0; i < exportedInventory.length; i++) {
    const rowId = `$${i}`;
    const item = exportedInventory[i];
    const definition = item.itemId ? itemMap.get(item.itemId) : undefined;

    const itemName = clean(item.name);
    const itemQty = clean(item.quantity);
    const itemNotes = clean(item.notes ?? definition?.description ?? "");

    setRepeatingValue("inventory", rowId, "itemname", itemName);
    setRepeatingValue("inventory", rowId, "itemqty", itemQty);
    setRepeatingValue("inventory", rowId, "itemnotes", itemNotes);
  }

  return result;
}

export function buildRoll20AttributeMapText(
  character: CharacterRecord,
  gameData: GameData
) {
  const map = buildRoll20AttributeMap(character, gameData);

  return Object.entries(map)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function buildRoll20AttributeMapJson(
  character: CharacterRecord,
  gameData: GameData
) {
  return JSON.stringify(buildRoll20AttributeMap(character, gameData), null, 2);
}

export function buildChatSetAttrCommand(
  character: CharacterRecord,
  gameData: GameData
): string {
  return buildChatSetAttrPhases(character, gameData).combined;
}

export function buildChatSetAttrPhases(
  character: CharacterRecord,
  gameData: GameData
): { phase1: string; phase2: string; combined: string } {
  const map = buildRoll20AttributeMap(character, gameData);
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

  const campaign = gameData.campaigns.find((value) => value.id === character.campaignId);
  const skillMap = new Map((campaign?.skills ?? []).map((skill) => [skill.id, skill]));

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
  const proficientSkills = character.skills
    .filter((skill) => skill.proficient)
    .slice(0, MAX_SKILL_ROWS);
  for (const skill of proficientSkills) {
    const def = skillMap.get(skill.skillId);
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
  for (const attack of character.attacks.slice(0, MAX_ATTACK_ROWS)) {
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
  for (const power of character.powers.slice(0, MAX_POWER_ROWS)) {
    const text = power.notes?.trim() ? `${power.name} - ${power.notes}` : power.name;
    repeatingCommands.push(
      `${setPrefix} ${makePair("repeating_powers_-CREATE_powertext", clean(text))}`
    );
  }

  // Repeating inventory.
  for (const item of character.inventory.slice(0, MAX_INVENTORY_ROWS)) {
    repeatingCommands.push(
      `${setPrefix} ${[
        makePair("repeating_inventory_-CREATE_itemname", clean(item.name)),
        makePair("repeating_inventory_-CREATE_itemqty", clean(item.quantity)),
        makePair("repeating_inventory_-CREATE_itemnotes", clean(item.notes ?? "")),
      ].join(" ")}`
    );
  }

  // Final touch can help the sheet UI repaint consistently after repeating updates.
  const finalHpCommand =
    `${setPrefix} ${makePair("hp_max", clean(character.hp.max))} ${makePair("hp_current", clean(character.hp.current))}`
  ;

  const phase1Commands = [...baseCommands, finalHpCommand];
  const phase2Commands = repeatingCommands;
  const phase1 = phase1Commands.join("\n");
  const phase2 = phase2Commands.join("\n");
  const combined = [...phase1Commands, ...phase2Commands].join("\n");

  return { phase1, phase2, combined };
}