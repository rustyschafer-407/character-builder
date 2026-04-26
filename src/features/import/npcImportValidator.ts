import { createCharacterFromCampaignAndClass, generateId, getAttributeModifier } from "../../lib/character";
import { syncDerivedAttacks } from "../../lib/attackSync";
import { syncCampaignDerivedAttackTemplates } from "../../lib/derivedAttacks";
import type { CharacterItem, CharacterPowerSelection } from "../../types/character";
import type {
  AttackTemplateDefinition,
  AttributeKey,
  CampaignDefinition,
  ClassDefinition,
  ItemDefinition,
  PowerDefinition,
  RaceDefinition,
  SkillDefinition,
} from "../../types/gameData";
import {
  NPC_IMPORT_FORMAT,
  NPC_IMPORT_SCHEMA_FIELDS,
  NPC_IMPORT_VERSION,
  type NpcImportApplyResult,
  type NpcImportPayload,
  type NpcImportPreview,
  type NpcImportWarning,
} from "./npcImportTypes";

const ATTRIBUTE_ALIASES: Record<string, AttributeKey> = {
  str: "STR",
  strength: "STR",
  dex: "DEX",
  dexterity: "DEX",
  con: "CON",
  constitution: "CON",
  int: "INT",
  intelligence: "INT",
  wis: "WIS",
  wisdom: "WIS",
  cha: "CHA",
  charisma: "CHA",
};

const CONTENT_KEYS = new Set(Object.keys(NPC_IMPORT_SCHEMA_FIELDS));

type RecordLike = Record<string, unknown>;

type ParsedCharacterItem = { name: string; quantity: number; notes?: string };

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function asRecord(value: unknown, label: string): RecordLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as RecordLike;
}

function asArray<T>(value: unknown, label: string): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array when provided.`);
  }
  return value as T[];
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = normalizeKey(value);
    if (["true", "yes", "1", "on"].includes(normalized)) return true;
    if (["false", "no", "0", "off"].includes(normalized)) return false;
  }
  return undefined;
}

function parseInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return undefined;
}

function parseAttribute(value: unknown): AttributeKey | undefined {
  if (typeof value !== "string") return undefined;
  return ATTRIBUTE_ALIASES[normalizeKey(value)];
}

class WarningCollector {
  private warnings: NpcImportWarning[] = [];

  add(warning: NpcImportWarning) {
    this.warnings.push(warning);
  }

  all() {
    return this.warnings;
  }
}

function warnUnknownFields(record: RecordLike, allowed: string[], label: string, warnings: WarningCollector) {
  const allowedSet = new Set(allowed.map((value) => normalizeKey(value)));
  const unknown = Object.keys(record).filter((key) => !allowedSet.has(normalizeKey(key)));
  if (unknown.length === 0) return;

  warnings.add({
    code: "unknown-fields",
    message: `${label} contains unsupported fields: ${unknown.sort().join(", ")}`,
  });
}

function ensureNoDuplicateNames(records: Array<{ name: string }>, label: string, warnings: WarningCollector) {
  const seen = new Set<string>();
  for (const record of records) {
    const normalized = normalizeName(record.name);
    if (seen.has(normalized)) {
      warnings.add({
        code: "duplicate-name",
        message: `${label} contains duplicate name "${record.name}" (case-insensitive).`,
      });
      continue;
    }
    seen.add(normalized);
  }
}

function mergeIds(existing: string[] | undefined, ids: string[]) {
  return Array.from(new Set([...(existing ?? []), ...ids]));
}

function buildBlankRace(campaign: CampaignDefinition, input: { name: string; description?: string }): RaceDefinition {
  return {
    id: `race-${generateId()}`,
    campaignId: campaign.id,
    name: input.name,
    description: input.description ?? "",
    attributeBonuses: [],
    defaultPowerIds: [],
    availableClassIds: [],
  };
}

function buildBlankClass(
  campaign: CampaignDefinition,
  input: { name: string; description?: string; hitDie?: number; hitDiceAtLevel1?: number }
): ClassDefinition {
  const hitDie = input.hitDie && input.hitDie > 0 ? input.hitDie : 8;
  const hitDiceAtLevel1 =
    input.hitDiceAtLevel1 && input.hitDiceAtLevel1 > 0 ? Math.floor(input.hitDiceAtLevel1) : 1;
  return {
    id: `class-${generateId()}`,
    campaignId: campaign.id,
    name: input.name,
    description: input.description ?? "",
    attributeBonuses: [],
    hpRule: {
      hitDie,
      hitDiceAtLevel1,
      level1Mode: "fixed-max",
      levelUpMode: "fixed-average",
      levelUpFixedValue: Math.max(1, Math.ceil(hitDie / 2)),
    },
    levelProgression: [
      {
        level: 2,
        hitDiceGained: 1,
        hpGainMode: "half",
        proficiencyBonus: 2,
        newSkillChoices: 0,
        newPowerChoices: 0,
        attributeBonuses: [],
      },
    ],
    startingAttackTemplateIds: [],
    defaultPowerIds: [],
    defaultItemIds: [],
    skillChoiceRules: [],
    powerChoiceRules: [],
    itemChoiceRules: [],
    levelUpSkillChoiceRules: [],
    levelUpPowerChoiceRules: [],
    levelUpItemChoiceRules: [],
  };
}

function parsePayload(rawJson: string): NpcImportPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Import JSON could not be parsed.");
  }

  const root = asRecord(parsed, "Import payload");
  if (root.format !== NPC_IMPORT_FORMAT) {
    throw new Error(`Import format must be ${NPC_IMPORT_FORMAT}.`);
  }
  if (root.version !== NPC_IMPORT_VERSION) {
    throw new Error(`Import version must be ${NPC_IMPORT_VERSION}.`);
  }

  const content = asRecord(root.content, "Import content") as NpcImportPayload["content"];
  const payload: NpcImportPayload = {
    format: NPC_IMPORT_FORMAT,
    version: NPC_IMPORT_VERSION,
    content: {
      skills: asArray(content.skills, "content.skills"),
      powers: asArray(content.powers, "content.powers"),
      items: asArray(content.items, "content.items"),
      attacks: asArray(content.attacks, "content.attacks"),
      races: asArray(content.races, "content.races"),
      classes: asArray(content.classes, "content.classes"),
      characters: asArray(content.characters, "content.characters"),
    },
  };

  if ((payload.content.characters ?? []).length === 0) {
    throw new Error("Import content must include at least one character.");
  }

  return payload;
}

export function buildNpcImportPreview(rawJson: string, campaign: CampaignDefinition): NpcImportPreview {
  const payload = parsePayload(rawJson);
  const warnings = new WarningCollector();
  const skillsContent = payload.content.skills ?? [];
  const powersContent = payload.content.powers ?? [];
  const itemsContent = payload.content.items ?? [];
  const attacksContent = payload.content.attacks ?? [];
  const racesContent = payload.content.races ?? [];
  const classesContent = payload.content.classes ?? [];
  const charactersContent = payload.content.characters ?? [];

  const unknownContentKeys = Object.keys(asRecord(payload.content, "Import content")).filter(
    (key) => !CONTENT_KEYS.has(key)
  );
  if (unknownContentKeys.length > 0) {
    warnings.add({
      code: "unknown-fields",
      message: `content contains unsupported sections: ${unknownContentKeys.sort().join(", ")}`,
    });
  }

  const skillsToCreate: SkillDefinition[] = [];
  const powersToCreate: PowerDefinition[] = [];
  const itemsToCreate: ItemDefinition[] = [];
  const attacksToCreate: AttackTemplateDefinition[] = [];
  const racesToCreate: RaceDefinition[] = [];
  const classesToCreate: ClassDefinition[] = [];

  const existingBy = {
    skills: new Map(campaign.skills.map((entry) => [normalizeName(entry.name), entry] as const)),
    powers: new Map(campaign.powers.map((entry) => [normalizeName(entry.name), entry] as const)),
    items: new Map(campaign.items.map((entry) => [normalizeName(entry.name), entry] as const)),
    attacks: new Map(campaign.attackTemplates.map((entry) => [normalizeName(entry.name), entry] as const)),
    races: new Map((campaign.races ?? []).map((entry) => [normalizeName(entry.name), entry] as const)),
    classes: new Map(campaign.classes.map((entry) => [normalizeName(entry.name), entry] as const)),
  };

  for (const [index, raw] of skillsContent.entries()) {
    const record = asRecord(raw, `Skill ${index + 1}`);
    warnUnknownFields(record, NPC_IMPORT_SCHEMA_FIELDS.skills as unknown as string[], `Skill ${index + 1}`, warnings);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      throw new Error(`Skill ${index + 1} is missing name.`);
    }
    if (existingBy.skills.has(normalizeName(name))) continue;

    const attribute = parseAttribute(record.attribute) ?? "STR";
    if (record.attribute !== undefined && !parseAttribute(record.attribute)) {
      warnings.add({
        code: "invalid-field",
        message: `Skill "${name}" has invalid attribute and defaulted to STR.`,
      });
    }

    skillsToCreate.push({
      id: `skill-${generateId()}`,
      name,
      attribute,
      description: typeof record.description === "string" ? record.description.trim() : "",
      tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [],
    });
  }

  for (const [index, raw] of powersContent.entries()) {
    const record = asRecord(raw, `Power ${index + 1}`);
    warnUnknownFields(record, NPC_IMPORT_SCHEMA_FIELDS.powers as unknown as string[], `Power ${index + 1}`, warnings);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      throw new Error(`Power ${index + 1} is missing name.`);
    }
    if (existingBy.powers.has(normalizeName(name))) continue;

    const level = parseInteger(record.level);
    const usesPerDay = parseInteger(record.usesPerDay);
    const isAttack = parseBoolean(record.isAttack) ?? false;
    const saveAttribute = parseAttribute(record.saveAttribute);

    powersToCreate.push({
      id: `power-${generateId()}`,
      name,
      level: level && level > 0 ? level : 1,
      description: typeof record.description === "string" ? record.description.trim() : "",
      tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [],
      isAttack,
      usesPerDay: usesPerDay !== undefined && usesPerDay >= 0 ? usesPerDay : undefined,
      saveAttribute,
      sourceText: typeof record.sourceText === "string" ? record.sourceText.trim() : "",
    });
  }

  for (const [index, raw] of itemsContent.entries()) {
    const record = asRecord(raw, `Item ${index + 1}`);
    warnUnknownFields(record, NPC_IMPORT_SCHEMA_FIELDS.items as unknown as string[], `Item ${index + 1}`, warnings);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      throw new Error(`Item ${index + 1} is missing name.`);
    }
    if (existingBy.items.has(normalizeName(name))) continue;

    itemsToCreate.push({
      id: `item-${generateId()}`,
      name,
      description: typeof record.description === "string" ? record.description.trim() : "",
      isAttack: parseBoolean(record.isAttack) ?? false,
      stackable: parseBoolean(record.stackable) ?? false,
      defaultQuantity: parseInteger(record.defaultQuantity) ?? 1,
      tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [],
    });
  }

  for (const [index, raw] of attacksContent.entries()) {
    const record = asRecord(raw, `Attack ${index + 1}`);
    warnUnknownFields(record, NPC_IMPORT_SCHEMA_FIELDS.attacks as unknown as string[], `Attack ${index + 1}`, warnings);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      throw new Error(`Attack ${index + 1} is missing name.`);
    }
    if (existingBy.attacks.has(normalizeName(name))) continue;

    attacksToCreate.push({
      id: `attack-${generateId()}`,
      name,
      attribute: parseAttribute(record.attribute) ?? "STR",
      damage: typeof record.damage === "string" && record.damage.trim() ? record.damage.trim() : "1d6",
      bonus: parseInteger(record.bonus) ?? 0,
      notes: typeof record.notes === "string" ? record.notes.trim() : "",
      tags: Array.isArray(record.tags) ? record.tags.filter((tag): tag is string => typeof tag === "string") : [],
    });
  }

  for (const [index, raw] of racesContent.entries()) {
    const record = asRecord(raw, `Race ${index + 1}`);
    warnUnknownFields(record, NPC_IMPORT_SCHEMA_FIELDS.races as unknown as string[], `Race ${index + 1}`, warnings);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      throw new Error(`Race ${index + 1} is missing name.`);
    }
    if (existingBy.races.has(normalizeName(name))) continue;

    racesToCreate.push(buildBlankRace(campaign, {
      name,
      description: typeof record.description === "string" ? record.description.trim() : "",
    }));
  }

  for (const [index, raw] of classesContent.entries()) {
    const record = asRecord(raw, `Class ${index + 1}`);
    warnUnknownFields(record, NPC_IMPORT_SCHEMA_FIELDS.classes as unknown as string[], `Class ${index + 1}`, warnings);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      throw new Error(`Class ${index + 1} is missing name.`);
    }
    if (existingBy.classes.has(normalizeName(name))) continue;

    classesToCreate.push(
      buildBlankClass(campaign, {
        name,
        description: typeof record.description === "string" ? record.description.trim() : "",
        hitDie: parseInteger(record.hitDie) ?? 8,
        hitDiceAtLevel1: parseInteger(record.hitDiceAtLevel1) ?? 1,
      })
    );
  }

  ensureNoDuplicateNames(skillsToCreate, "skills", warnings);
  ensureNoDuplicateNames(powersToCreate, "powers", warnings);
  ensureNoDuplicateNames(itemsToCreate, "items", warnings);
  ensureNoDuplicateNames(attacksToCreate, "attacks", warnings);
  ensureNoDuplicateNames(racesToCreate, "races", warnings);
  ensureNoDuplicateNames(classesToCreate, "classes", warnings);

  const characterRaw = charactersContent[0];
  const characterRecord = asRecord(characterRaw, "Character 1");
  warnUnknownFields(characterRecord, NPC_IMPORT_SCHEMA_FIELDS.characters as unknown as string[], "Character 1", warnings);

  const characterName = typeof characterRecord.name === "string" ? characterRecord.name.trim() : "";
  if (!characterName) {
    throw new Error("Character 1 is missing name.");
  }

  if (typeof characterRecord.type === "string" && normalizeName(characterRecord.type) !== "npc") {
    warnings.add({
      code: "forced-character-type",
      message: `Character type "${characterRecord.type}" was overridden to NPC.`,
    });
  }

  const referencedSkillNames = asArray<string>(characterRecord.skills, "characters[0].skills").filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  const referencedPowerNames = asArray<string>(characterRecord.powers, "characters[0].powers").filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  const referencedAttackNames = asArray<string>(characterRecord.attacks, "characters[0].attacks").filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );

  const referencedItemsRaw = asArray<unknown>(characterRecord.items, "characters[0].items");
  const referencedItemEntries: ParsedCharacterItem[] = referencedItemsRaw
    .map((entry) => {
      if (typeof entry === "string") {
        return { name: entry, quantity: 1 };
      }
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const record = entry as RecordLike;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) return null;
      return {
        name,
        quantity: parseInteger(record.quantity) ?? 1,
        notes: typeof record.notes === "string" ? record.notes.trim() : undefined,
      };
    })
    .filter((entry): entry is ParsedCharacterItem => Boolean(entry));

  const referencedRaceName = typeof characterRecord.race === "string" ? characterRecord.race.trim() : "";
  const referencedClassName = typeof characterRecord.class === "string" ? characterRecord.class.trim() : "";
  const referencedLevel = parseInteger(characterRecord.level);

  const attributeRecord = characterRecord.attributes && typeof characterRecord.attributes === "object" && !Array.isArray(characterRecord.attributes)
    ? (characterRecord.attributes as RecordLike)
    : {};

  const attributes: Partial<Record<AttributeKey, number>> = {};
  for (const key of ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const) {
    const value = parseInteger(attributeRecord[key]);
    if (value !== undefined) {
      attributes[key] = value;
    }
  }

  const newNames = {
    skills: new Set(skillsToCreate.map((entry) => normalizeName(entry.name))),
    powers: new Set(powersToCreate.map((entry) => normalizeName(entry.name))),
    items: new Set(itemsToCreate.map((entry) => normalizeName(entry.name))),
    attacks: new Set(attacksToCreate.map((entry) => normalizeName(entry.name))),
    races: new Set(racesToCreate.map((entry) => normalizeName(entry.name))),
    classes: new Set(classesToCreate.map((entry) => normalizeName(entry.name))),
  };

  const referenceGroups: Array<{ label: string; names: string[]; existing: Map<string, { id: string; name: string }>; created: Set<string> }> = [
    { label: "skills", names: referencedSkillNames, existing: existingBy.skills, created: newNames.skills },
    { label: "powers", names: referencedPowerNames, existing: existingBy.powers, created: newNames.powers },
    { label: "items", names: referencedItemEntries.map((entry) => entry.name), existing: existingBy.items, created: newNames.items },
    { label: "attacks", names: referencedAttackNames, existing: existingBy.attacks, created: newNames.attacks },
  ];

  for (const group of referenceGroups) {
    for (const rawName of group.names) {
      const normalized = normalizeName(rawName);
      if (group.existing.has(normalized) || group.created.has(normalized)) {
        continue;
      }
      warnings.add({
        code: "invalid-reference",
        message: `Character references missing ${group.label.slice(0, -1)} "${rawName}".`,
      });
    }
  }

  if (referencedRaceName) {
    const normalized = normalizeName(referencedRaceName);
    if (!existingBy.races.has(normalized) && !newNames.races.has(normalized)) {
      warnings.add({
        code: "invalid-reference",
        message: `Character references missing race "${referencedRaceName}".`,
      });
    }
  }

  if (referencedClassName) {
    const normalized = normalizeName(referencedClassName);
    if (!existingBy.classes.has(normalized) && !newNames.classes.has(normalized)) {
      warnings.add({
        code: "invalid-reference",
        message: `Character references missing class "${referencedClassName}".`,
      });
    }
  }

  const reuse = {
    skills: campaign.skills.filter((entry) => referencedSkillNames.some((name) => normalizeName(name) === normalizeName(entry.name))),
    powers: campaign.powers.filter((entry) => referencedPowerNames.some((name) => normalizeName(name) === normalizeName(entry.name))),
    items: campaign.items.filter((entry) => referencedItemEntries.some((item) => normalizeName(item.name) === normalizeName(entry.name))),
    attacks: campaign.attackTemplates.filter((entry) => referencedAttackNames.some((name) => normalizeName(name) === normalizeName(entry.name))),
    races: (campaign.races ?? []).filter((entry) => referencedRaceName && normalizeName(referencedRaceName) === normalizeName(entry.name)),
    classes: campaign.classes.filter((entry) => referencedClassName && normalizeName(referencedClassName) === normalizeName(entry.name)),
  };

  return {
    payload,
    warnings: warnings.all(),
    toCreate: {
      skills: skillsToCreate,
      powers: powersToCreate,
      items: itemsToCreate,
      attacks: attacksToCreate,
      races: racesToCreate,
      classes: classesToCreate,
    },
    toReuse: reuse,
    characterPlan: {
      name: characterName,
      type: "npc",
      raceName: referencedRaceName || undefined,
      className: referencedClassName || undefined,
      level: referencedLevel !== undefined && referencedLevel > 0 ? referencedLevel : undefined,
      attributes,
      skillNames: referencedSkillNames,
      powerNames: referencedPowerNames,
      itemNames: referencedItemEntries,
      attackNames: referencedAttackNames,
      notes: typeof characterRecord.notes === "string" ? characterRecord.notes.trim() : "",
    },
  };
}

function findByName<T extends { id: string; name: string }>(records: T[], name: string) {
  const normalized = normalizeName(name);
  return records.find((entry) => normalizeName(entry.name) === normalized);
}

export function applyNpcImport(campaign: CampaignDefinition, preview: NpcImportPreview): NpcImportApplyResult {
  const nextSkills = [...campaign.skills];
  const nextPowers = [...campaign.powers];
  const nextItems = [...campaign.items];
  const nextAttacks = [...campaign.attackTemplates];
  const nextRaces = [...(campaign.races ?? [])];
  const nextClasses = [...campaign.classes];

  for (const entry of preview.toCreate.skills) {
    if (!findByName(nextSkills, entry.name)) {
      nextSkills.push(entry);
    }
  }

  for (const entry of preview.toCreate.powers) {
    if (!findByName(nextPowers, entry.name)) {
      nextPowers.push(entry);
    }
  }

  for (const entry of preview.toCreate.items) {
    if (!findByName(nextItems, entry.name)) {
      nextItems.push(entry);
    }
  }

  for (const entry of preview.toCreate.attacks) {
    if (!findByName(nextAttacks, entry.name)) {
      nextAttacks.push(entry);
    }
  }

  for (const entry of preview.toCreate.races) {
    if (!findByName(nextRaces, entry.name)) {
      nextRaces.push(entry);
    }
  }

  for (const entry of preview.toCreate.classes) {
    if (!findByName(nextClasses, entry.name)) {
      nextClasses.push(entry);
    }
  }

  const mergedCampaign: CampaignDefinition = {
    ...campaign,
    skills: nextSkills,
    powers: nextPowers,
    items: nextItems,
    attackTemplates: nextAttacks,
    races: nextRaces,
    classes: nextClasses,
    availableSkillIds: mergeIds(campaign.availableSkillIds, preview.toCreate.skills.map((entry) => entry.id)),
    availablePowerIds: mergeIds(campaign.availablePowerIds, preview.toCreate.powers.map((entry) => entry.id)),
    availableItemIds: mergeIds(campaign.availableItemIds, preview.toCreate.items.map((entry) => entry.id)),
    availableAttackTemplateIds: mergeIds(campaign.availableAttackTemplateIds, preview.toCreate.attacks.map((entry) => entry.id)),
    availableRaceIds: mergeIds(campaign.availableRaceIds, preview.toCreate.races.map((entry) => entry.id)),
    availableClassIds: mergeIds(campaign.availableClassIds, preview.toCreate.classes.map((entry) => entry.id)),
  };

  const syncedCampaign = syncCampaignDerivedAttackTemplates(mergedCampaign);

  const classByName = (name: string) => findByName(syncedCampaign.classes, name);
  const raceByName = (name: string) => findByName(syncedCampaign.races ?? [], name);
  const skillByName = (name: string) => findByName(syncedCampaign.skills, name);
  const powerByName = (name: string) => findByName(syncedCampaign.powers, name);
  const itemByName = (name: string) => findByName(syncedCampaign.items, name);
  const attackByName = (name: string) => findByName(syncedCampaign.attackTemplates, name);

  const selectedClass =
    (preview.characterPlan.className ? classByName(preview.characterPlan.className) : undefined) ??
    syncedCampaign.classes[0];

  if (!selectedClass) {
    throw new Error("NPC import requires at least one class in the campaign.");
  }

  const selectedRace = preview.characterPlan.raceName ? raceByName(preview.characterPlan.raceName) ?? null : null;

  const baseCharacter = createCharacterFromCampaignAndClass(
    syncedCampaign,
    selectedClass,
    preview.characterPlan.name,
    selectedRace
  );

  const selectedSkillIds = new Set(
    preview.characterPlan.skillNames
      .map((name) => skillByName(name)?.id)
      .filter((id): id is string => Boolean(id))
  );

  const nextSkillsForCharacter = baseCharacter.skills.map((skill) => {
    const referenced = selectedSkillIds.has(skill.skillId);
    return {
      ...skill,
      proficient: referenced,
      source: referenced ? "manual" : skill.source,
    };
  });

  const nextPowersForCharacter: CharacterPowerSelection[] = preview.characterPlan.powerNames
    .map((name) => powerByName(name))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      powerId: entry.id,
      name: entry.name,
      notes: entry.description ?? "",
      description: entry.description,
      usesPerDay: entry.usesPerDay,
      saveAttribute: entry.saveAttribute,
      source: "manual",
    }));

  const nextItemsForCharacter: CharacterItem[] = preview.characterPlan.itemNames
    .map((entry) => {
      const item = itemByName(entry.name);
      if (!item) return null;
      return {
        itemId: item.id,
        name: item.name,
        quantity: Math.max(1, entry.quantity),
        notes: entry.notes ?? item.description,
        source: "manual" as const,
      };
    })
    .filter((entry) => Boolean(entry)) as CharacterItem[];

  const manualAttacks = preview.characterPlan.attackNames
    .map((name) => attackByName(name))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      id: generateId(),
      templateId: entry.id,
      name: entry.name,
      attribute: entry.attribute,
      damage: entry.damage,
      bonus: entry.bonus ?? 0,
      notes: entry.notes ?? "",
      damageBonus: 0,
    }));

  const desiredLevel = preview.characterPlan.level && preview.characterPlan.level > 0 ? preview.characterPlan.level : 1;
  const nextAttributes = {
    ...baseCharacter.attributes,
    ...preview.characterPlan.attributes,
  };

  const hitDiceAtLevel1 =
    Number.isFinite(selectedClass.hpRule.hitDiceAtLevel1) && Number(selectedClass.hpRule.hitDiceAtLevel1) > 0
      ? Math.max(1, Math.floor(Number(selectedClass.hpRule.hitDiceAtLevel1)))
      : 1;
  const baseHp = selectedClass.hpRule.hitDie * hitDiceAtLevel1;
  const hpMax = Math.max(baseHp, baseHp + getAttributeModifier(nextAttributes.CON));

  const characterWithSelections = {
    ...baseCharacter,
    characterType: "npc" as const,
    identity: {
      ...baseCharacter.identity,
      notes: preview.characterPlan.notes ?? baseCharacter.identity.notes,
    },
    level: desiredLevel,
    attributes: nextAttributes,
    hp: {
      ...baseCharacter.hp,
      max: hpMax,
      current: hpMax,
      hitDie: selectedClass.hpRule.hitDie,
    },
    skills: nextSkillsForCharacter,
    powers: nextPowersForCharacter,
    inventory: nextItemsForCharacter,
    attacks: manualAttacks,
  };

  const syncedAttacks = syncDerivedAttacks(
    {
      powers: characterWithSelections.powers,
      inventory: characterWithSelections.inventory,
      attacks: characterWithSelections.attacks,
    },
    syncedCampaign
  );

  // Deduplicate by name — keep first occurrence (manual attacks are processed first
  // by syncDerivedAttacks so they retain their full damage/bonus data).
  const seenAttackNames = new Set<string>();
  const attacks = syncedAttacks.filter((attack) => {
    const key = attack.name.trim().toLowerCase();
    if (seenAttackNames.has(key)) return false;
    seenAttackNames.add(key);
    return true;
  });

  const draft = {
    characterType: "npc" as const,
    identity: characterWithSelections.identity,
    campaignId: syncedCampaign.id,
    raceId: characterWithSelections.raceId ?? "",
    classId: characterWithSelections.classId,
    level: characterWithSelections.level,
    proficiencyBonus: characterWithSelections.proficiencyBonus,
    attributes: characterWithSelections.attributes,
    saveProf: { ...characterWithSelections.sheet.saveProf },
    attributeGeneration: characterWithSelections.attributeGeneration,
    hp: characterWithSelections.hp,
    skills: characterWithSelections.skills,
    powers: characterWithSelections.powers,
    inventory: characterWithSelections.inventory,
    attacks,
    levelProgression: characterWithSelections.levelProgression,
  };

  return {
    campaign: syncedCampaign,
    draft,
    warnings: preview.warnings,
  };
}
