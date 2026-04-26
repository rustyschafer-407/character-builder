import { generateId } from "../lib/character";
import {
  extractDamageDiceFromText,
  normalizeDerivedAttackName,
  syncCampaignDerivedAttackTemplates,
} from "../lib/derivedAttacks";
import type { AttributeKey, CampaignDefinition, ItemDefinition, PowerDefinition, SkillDefinition } from "../types/gameData";

export interface CampaignContentImportPayload {
  format: string;
  version: number;
  content: {
    powers?: CampaignContentImportPower[];
    skills?: CampaignContentImportSkill[];
    items?: CampaignContentImportItem[];
  };
}

export interface CampaignContentImportPower {
  name?: string;
  level?: number | string;
  usesPerDay?: number | string;
  powerAttribute?: string;
  attackAttribute?: string;
  usableAsAttack?: boolean;
  description?: string;
  [key: string]: unknown;
}

export interface CampaignContentImportSkill {
  name?: string;
  attribute?: string;
  [key: string]: unknown;
}

export interface CampaignContentImportItem {
  name?: string;
  usableAsAttack?: boolean;
  attackAttribute?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ImportWarning {
  code:
    | "missing-description"
    | "unknown-fields"
    | "unsupported-fields"
    | "invalid-attribute"
    | "invalid-number"
    | "invalid-boolean"
    | "attack-no-dice"
    | "attack-name-exists"
    | "attack-sync-failed";
  message: string;
}

export interface ImportPreview {
  payload: CampaignContentImportPayload;
  powers: PowerDefinition[];
  skills: SkillDefinition[];
  items: ItemDefinition[];
  attackAttributeHintsByName: {
    powers: Record<string, AttributeKey | undefined>;
    items: Record<string, AttributeKey | undefined>;
  };
  duplicateCount: number;
  duplicateCounts: {
    powers: number;
    skills: number;
    items: number;
  };
  attacksToCreate: number;
  attacksToCreateByMode: {
    skip: number;
    update: number;
  };
  warnings: ImportWarning[];
}

export interface ImportResult {
  campaign: CampaignDefinition;
  importedCounts: {
    powers: number;
    skills: number;
    items: number;
    attacks: number;
  };
  skippedDuplicates: number;
  warnings: ImportWarning[];
}

export type DuplicateHandlingMode = "skip" | "update";

const EXPECTED_FORMAT = "character-builder.campaign-content-import";
const EXPECTED_VERSION = 1;

type RawRecord = Record<string, unknown>;
type ParsedPowerImport = { record: PowerDefinition; attackAttributeHint?: AttributeKey };
type ParsedItemImport = { record: ItemDefinition; attackAttributeHint?: AttributeKey };

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

const RANGED_ATTACK_HINT_PATTERN = /\b(ranged|range|bow|crossbow|gun|rifle|pistol|firearm|projectile|throw|thrown|shot|shoot)\b/i;
const MELEE_ATTACK_HINT_PATTERN = /\b(melee|sword|axe|hammer|mace|spear|blade|dagger|club|staff|punch|kick|unarmed|strike)\b/i;

class WarningCollector {
  private counts = new Map<string, { code: ImportWarning["code"]; message: string; count: number }>();

  add(code: ImportWarning["code"], message: string) {
    const existing = this.counts.get(message);
    if (existing) {
      existing.count += 1;
      return;
    }
    this.counts.set(message, { code, message, count: 1 });
  }

  toArray(): ImportWarning[] {
    return Array.from(this.counts.values()).map(({ code, message, count }) => ({
      code,
      message: count > 1 ? `${message} (${count} records)` : message,
    }));
  }
}

function normalizeImportKey(key: string) {
  return key.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeImportName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function asRecord(value: unknown, contextLabel: string): RawRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${contextLabel} must be an object.`);
  }
  return value as RawRecord;
}

function buildNormalizedRecord(record: RawRecord) {
  const byNormalizedKey = new Map<string, unknown>();
  const originalKeysByNormalizedKey = new Map<string, string>();

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeImportKey(key);
    if (!normalizedKey) continue;
    if (!byNormalizedKey.has(normalizedKey)) {
      byNormalizedKey.set(normalizedKey, value);
      originalKeysByNormalizedKey.set(normalizedKey, key);
    }
  }

  return { byNormalizedKey, originalKeysByNormalizedKey };
}

function readAliasedValue(record: ReturnType<typeof buildNormalizedRecord>, aliases: string[]) {
  for (const alias of aliases) {
    const value = record.byNormalizedKey.get(alias);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function stringifyMetadataValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function parseAttributeKey(value: unknown): AttributeKey | undefined {
  if (typeof value !== "string") return undefined;
  return ATTRIBUTE_ALIASES[normalizeImportKey(value)];
}

function inferAttackAttributeFromDescription(description: string | undefined): AttributeKey | undefined {
  if (!description) return undefined;
  if (RANGED_ATTACK_HINT_PATTERN.test(description)) return "DEX";
  if (MELEE_ATTACK_HINT_PATTERN.test(description)) return "STR";
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value === "string") {
    const normalized = normalizeImportKey(value);
    if (["true", "yes", "y", "1", "on"].includes(normalized)) return true;
    if (["false", "no", "n", "0", "off"].includes(normalized)) return false;
  }
  return undefined;
}

function ensureArray<T>(value: unknown, label: string): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array when provided.`);
  }
  return value as T[];
}

function addUnknownFieldWarnings(
  targetLabel: string,
  normalizedRecord: ReturnType<typeof buildNormalizedRecord>,
  knownKeys: Set<string>,
  warnings: WarningCollector
) {
  const unknownPrimitiveFields: string[] = [];
  let hasUnsupportedFields = false;

  for (const [normalizedKey, value] of normalizedRecord.byNormalizedKey.entries()) {
    if (knownKeys.has(normalizedKey)) continue;
    const originalKey = normalizedRecord.originalKeysByNormalizedKey.get(normalizedKey) ?? normalizedKey;
    if (stringifyMetadataValue(value) !== null) {
      unknownPrimitiveFields.push(originalKey);
    } else {
      hasUnsupportedFields = true;
    }
  }

  if (unknownPrimitiveFields.length > 0) {
    warnings.add(
      "unknown-fields",
      `${targetLabel} includes unknown fields (${unknownPrimitiveFields.sort().join(", ")})`
    );
  }
  if (hasUnsupportedFields) {
    warnings.add(
      "unsupported-fields",
      `${targetLabel} includes unsupported fields that could not be mapped`
    );
  }
}

function validateImportEnvelope(payload: unknown): CampaignContentImportPayload {
  const root = asRecord(payload, "Import payload");
  if (root.format !== EXPECTED_FORMAT) {
    throw new Error(`Import format must be ${EXPECTED_FORMAT}.`);
  }
  if (root.version !== EXPECTED_VERSION) {
    throw new Error(`Import version must be ${EXPECTED_VERSION}.`);
  }
  if (!root.content || typeof root.content !== "object" || Array.isArray(root.content)) {
    throw new Error("Import content is required.");
  }

  const content = root.content as CampaignContentImportPayload["content"];
  const powers = ensureArray<CampaignContentImportPower>(content.powers, "content.powers");
  const skills = ensureArray<CampaignContentImportSkill>(content.skills, "content.skills");
  const items = ensureArray<CampaignContentImportItem>(content.items, "content.items");

  if (powers.length === 0 && skills.length === 0 && items.length === 0) {
    throw new Error("Import content must include at least one power, skill, or item.");
  }

  return {
    format: EXPECTED_FORMAT,
    version: EXPECTED_VERSION,
    content: {
      powers,
      skills,
      items,
    },
  };
}

function parseSkillRecord(record: RawRecord, index: number, warnings: WarningCollector): SkillDefinition {
  const normalizedRecord = buildNormalizedRecord(record);
  const nameValue = readAliasedValue(normalizedRecord, ["name"]);
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  if (!name) {
    throw new Error(`Skill ${index + 1} is missing a name.`);
  }

  const attributeValue = readAliasedValue(normalizedRecord, ["attribute", "skillattribute"]);
  const attribute = parseAttributeKey(attributeValue);
  if (!attribute && attributeValue !== undefined) {
    warnings.add("invalid-attribute", "Skill entries include unrecognized attributes and defaulted to STR");
  }

  addUnknownFieldWarnings(
    `Skill \"${name}\"`,
    normalizedRecord,
    new Set(["name", "attribute", "skillattribute"]),
    warnings
  );

  return {
    id: `skill-${generateId()}`,
    name,
    attribute: attribute ?? "STR",
    tags: [],
  };
}

function parsePowerRecord(record: RawRecord, index: number, warnings: WarningCollector): ParsedPowerImport {
  const normalizedRecord = buildNormalizedRecord(record);
  const nameValue = readAliasedValue(normalizedRecord, ["name"]);
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  if (!name) {
    throw new Error(`Power ${index + 1} is missing a name.`);
  }

  const descriptionValue = readAliasedValue(normalizedRecord, ["description"]);
  if (descriptionValue === undefined || `${descriptionValue}`.trim() === "") {
    warnings.add("missing-description", "Power entries are missing description");
  }

  const levelValue = readAliasedValue(normalizedRecord, ["level"]);
  const parsedLevel = parseNumber(levelValue);
  if (levelValue !== undefined && parsedLevel === undefined) {
    warnings.add("invalid-number", "Power entries include invalid levels and defaulted to 1");
  }

  const usesPerDayValue = readAliasedValue(normalizedRecord, ["usesperday"]);
  const parsedUsesPerDay = parseNumber(usesPerDayValue);
  if (usesPerDayValue !== undefined && parsedUsesPerDay === undefined) {
    warnings.add("invalid-number", "Power entries include invalid uses per day values and they were ignored");
  }

  const saveAttributeValue = readAliasedValue(normalizedRecord, ["powerattribute"]);
  const saveAttribute = parseAttributeKey(saveAttributeValue);
  if (!saveAttribute && saveAttributeValue !== undefined) {
    warnings.add("invalid-attribute", "Power entries include unrecognized power attributes and they were ignored");
  }

  const attackAttributeValue = readAliasedValue(normalizedRecord, ["attackattribute"]);
  const attackAttribute = parseAttributeKey(attackAttributeValue);
  if (!attackAttribute && attackAttributeValue !== undefined) {
    warnings.add("invalid-attribute", "Power entries include unrecognized attack attributes and they were ignored");
  }

  const usableAsAttackValue = readAliasedValue(normalizedRecord, ["usableasattack"]);
  const usableAsAttack = parseBoolean(usableAsAttackValue);
  if (usableAsAttackValue !== undefined && usableAsAttack === undefined) {
    warnings.add("invalid-boolean", "Power entries include invalid usable as attack values and defaulted to false");
  }

  const normalizedDescription = typeof descriptionValue === "string" ? descriptionValue.trim() : "";
  if ((usableAsAttack ?? false) && !extractDamageDiceFromText(normalizedDescription)) {
    warnings.add("attack-no-dice", `Power \"${name}\" is usable as attack but no damage dice were found. Attack will be created without damage.`);
  }

  addUnknownFieldWarnings(
    `Power \"${name}\"`,
    normalizedRecord,
    new Set(["name", "level", "usesperday", "powerattribute", "attackattribute", "usableasattack", "description"]),
    warnings
  );

  const inferredAttackAttribute = inferAttackAttributeFromDescription(normalizedDescription);
  const attackAttributeHint = attackAttribute ?? saveAttribute ?? inferredAttackAttribute;

  return {
    record: {
      id: `power-${generateId()}`,
      name,
      level: parsedLevel !== undefined ? Math.max(1, Math.floor(parsedLevel)) : 1,
      description: normalizedDescription,
      tags: [],
      isAttack: usableAsAttack ?? false,
      sourceText: "",
      usesPerDay: parsedUsesPerDay !== undefined ? Math.max(0, Math.floor(parsedUsesPerDay)) : undefined,
      saveAttribute,
    },
    attackAttributeHint,
  };
}

function parseItemRecord(record: RawRecord, index: number, warnings: WarningCollector): ParsedItemImport {
  const normalizedRecord = buildNormalizedRecord(record);
  const nameValue = readAliasedValue(normalizedRecord, ["name"]);
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  if (!name) {
    throw new Error(`Item ${index + 1} is missing a name.`);
  }

  const descriptionValue = readAliasedValue(normalizedRecord, ["description"]);
  if (descriptionValue === undefined || `${descriptionValue}`.trim() === "") {
    warnings.add("missing-description", "Item entries are missing description");
  }

  const isAttackValue = readAliasedValue(normalizedRecord, ["usableasattackflag", "usableasattack", "isattack"]);
  const isAttack = parseBoolean(isAttackValue);
  if (isAttackValue !== undefined && isAttack === undefined) {
    warnings.add("invalid-boolean", "Item entries include invalid usable as attack flags and defaulted to false");
  }

  const attackAttributeValue = readAliasedValue(normalizedRecord, ["attackattribute"]);
  const attackAttribute = parseAttributeKey(attackAttributeValue);
  if (!attackAttribute && attackAttributeValue !== undefined) {
    warnings.add("invalid-attribute", "Item entries include unrecognized attack attributes and they were ignored");
  }

  const normalizedDescription = typeof descriptionValue === "string" ? descriptionValue.trim() : "";
  if ((isAttack ?? false) && !extractDamageDiceFromText(normalizedDescription)) {
    warnings.add("attack-no-dice", `Item \"${name}\" is usable as attack but no damage dice were found. Attack will be created without damage.`);
  }

  addUnknownFieldWarnings(
    `Item \"${name}\"`,
    normalizedRecord,
    new Set(["name", "usableasattackflag", "usableasattack", "isattack", "attackattribute", "description"]),
    warnings
  );

  const inferredAttackAttribute = inferAttackAttributeFromDescription(normalizedDescription);
  const attackAttributeHint = attackAttribute ?? inferredAttackAttribute;

  return {
    record: {
      id: `item-${generateId()}`,
      name,
      description: normalizedDescription,
      isAttack: isAttack ?? false,
      stackable: false,
      defaultQuantity: 1,
      tags: [],
    },
    attackAttributeHint,
  };
}

function getDuplicateCounts(campaign: CampaignDefinition, preview: Pick<ImportPreview, "powers" | "skills" | "items">) {
  const existingPowerNames = new Set(campaign.powers.map((power) => normalizeImportName(power.name)));
  const existingSkillNames = new Set(campaign.skills.map((skill) => normalizeImportName(skill.name)));
  const existingItemNames = new Set(campaign.items.map((item) => normalizeImportName(item.name)));

  const powers = preview.powers.filter((power) => existingPowerNames.has(normalizeImportName(power.name))).length;
  const skills = preview.skills.filter((skill) => existingSkillNames.has(normalizeImportName(skill.name))).length;
  const items = preview.items.filter((item) => existingItemNames.has(normalizeImportName(item.name))).length;

  return {
    powers,
    skills,
    items,
    total: powers + skills + items,
  };
}

function estimateAttackCreationsByMode(
  campaign: CampaignDefinition,
  powers: PowerDefinition[],
  items: ItemDefinition[],
  duplicateCounts: { powers: number; items: number }
) {
  const existingPowerNames = new Set(campaign.powers.map((power) => normalizeImportName(power.name)));
  const existingItemNames = new Set(campaign.items.map((item) => normalizeImportName(item.name)));

  const compute = (mode: DuplicateHandlingMode) => {
    const seenAttackNames = new Set(
      campaign.attackTemplates.map((attack) => normalizeDerivedAttackName(attack.name))
    );
    let created = 0;

    for (const power of powers) {
      const powerName = normalizeImportName(power.name);
      const isDuplicatePower = existingPowerNames.has(powerName);
      if (mode === "skip" && isDuplicatePower) {
        continue;
      }
      if (!power.isAttack) continue;
      const attackName = normalizeDerivedAttackName(power.name);
      if (!attackName || seenAttackNames.has(attackName)) {
        continue;
      }
      seenAttackNames.add(attackName);
      created += 1;
    }

    for (const item of items) {
      const itemName = normalizeImportName(item.name);
      const isDuplicateItem = existingItemNames.has(itemName);
      if (mode === "skip" && isDuplicateItem) {
        continue;
      }
      if (!item.isAttack) continue;
      const attackName = normalizeDerivedAttackName(item.name);
      if (!attackName || seenAttackNames.has(attackName)) {
        continue;
      }
      seenAttackNames.add(attackName);
      created += 1;
    }

    return created;
  };

  return {
    skip: compute("skip"),
    update: compute("update"),
    skippedSourceDuplicates: duplicateCounts.powers + duplicateCounts.items,
  };
}

function addAttackNameConflictWarnings(
  campaign: CampaignDefinition,
  powers: PowerDefinition[],
  items: ItemDefinition[],
  warnings: WarningCollector
) {
  const existingAttackNames = new Set(
    campaign.attackTemplates.map((attack) => normalizeDerivedAttackName(attack.name))
  );

  for (const power of powers) {
    if (!power.isAttack) continue;
    const normalizedName = normalizeDerivedAttackName(power.name);
    if (normalizedName && existingAttackNames.has(normalizedName)) {
      warnings.add("attack-name-exists", `Attack \"${power.name}\" already exists and will be skipped.`);
    }
  }

  for (const item of items) {
    if (!item.isAttack) continue;
    const normalizedName = normalizeDerivedAttackName(item.name);
    if (normalizedName && existingAttackNames.has(normalizedName)) {
      warnings.add("attack-name-exists", `Attack \"${item.name}\" already exists and will be skipped.`);
    }
  }
}

export function buildCampaignImportPreview(rawJson: string, campaign: CampaignDefinition): ImportPreview {
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(rawJson);
  } catch {
    throw new Error("Import JSON could not be parsed.");
  }

  const payload = validateImportEnvelope(parsedPayload);
  const warnings = new WarningCollector();
  const parsedPowers = payload.content.powers?.map((entry, index) => parsePowerRecord(asRecord(entry, `Power ${index + 1}`), index, warnings)) ?? [];
  const powers = parsedPowers.map((entry) => entry.record);
  const skills = payload.content.skills?.map((entry, index) => parseSkillRecord(asRecord(entry, `Skill ${index + 1}`), index, warnings)) ?? [];
  const parsedItems = payload.content.items?.map((entry, index) => parseItemRecord(asRecord(entry, `Item ${index + 1}`), index, warnings)) ?? [];
  const items = parsedItems.map((entry) => entry.record);

  const attackAttributeHintsByName = {
    powers: Object.fromEntries(
      parsedPowers.map((entry) => [normalizeImportName(entry.record.name), entry.attackAttributeHint])
    ),
    items: Object.fromEntries(
      parsedItems.map((entry) => [normalizeImportName(entry.record.name), entry.attackAttributeHint])
    ),
  };

  const duplicateCounts = getDuplicateCounts(campaign, { powers, skills, items });
  addAttackNameConflictWarnings(campaign, powers, items, warnings);
  const attacksToCreateByMode = estimateAttackCreationsByMode(campaign, powers, items, {
    powers: duplicateCounts.powers,
    items: duplicateCounts.items,
  });

  return {
    payload,
    powers,
    skills,
    items,
    attackAttributeHintsByName,
    duplicateCount: duplicateCounts.total,
    duplicateCounts,
    attacksToCreate: attacksToCreateByMode.skip,
    attacksToCreateByMode: {
      skip: attacksToCreateByMode.skip,
      update: attacksToCreateByMode.update,
    },
    warnings: warnings.toArray(),
  };
}

function mergeAvailableIds(existing: string[] | undefined, importedIds: string[]) {
  return Array.from(new Set([...(existing ?? []), ...importedIds]));
}

function applyImportedEntries<T extends { id: string; name: string }>(input: {
  existing: T[];
  imported: T[];
  mode: DuplicateHandlingMode;
  merge: (existing: T, imported: T) => T;
}) {
  const existingByName = new Map(input.existing.map((entry) => [normalizeImportName(entry.name), entry] as const));
  const nextEntries = [...input.existing];
  let appliedCount = 0;
  let skippedDuplicates = 0;
  const addedIds: string[] = [];
  const appliedImportedEntries: T[] = [];

  for (const importedEntry of input.imported) {
    const normalizedName = normalizeImportName(importedEntry.name);
    const existingEntry = existingByName.get(normalizedName);
    if (!existingEntry) {
      nextEntries.push(importedEntry);
      existingByName.set(normalizedName, importedEntry);
      addedIds.push(importedEntry.id);
      appliedCount += 1;
      appliedImportedEntries.push(importedEntry);
      continue;
    }

    if (input.mode === "skip") {
      skippedDuplicates += 1;
      continue;
    }

    const merged = input.merge(existingEntry, importedEntry);
    const index = nextEntries.findIndex((entry) => entry.id === existingEntry.id);
    if (index >= 0) {
      nextEntries[index] = merged;
    }
    existingByName.set(normalizedName, merged);
    appliedCount += 1;
    appliedImportedEntries.push(merged);
  }

  return {
    entries: nextEntries,
    appliedCount,
    skippedDuplicates,
    addedIds,
    appliedImportedEntries,
  };
}

export function applyCampaignImport(
  campaign: CampaignDefinition,
  preview: ImportPreview,
  mode: DuplicateHandlingMode
): ImportResult {
  const appliedPowers = applyImportedEntries({
    existing: campaign.powers,
    imported: preview.powers,
    mode,
    merge: (existing, imported) => ({
      ...existing,
      name: imported.name,
      level: imported.level,
      description: imported.description,
      isAttack: imported.isAttack,
      usesPerDay: imported.usesPerDay,
      saveAttribute: imported.saveAttribute,
      sourceText: imported.sourceText || existing.sourceText,
    }),
  });

  const appliedSkills = applyImportedEntries({
    existing: campaign.skills,
    imported: preview.skills,
    mode,
    merge: (existing, imported) => ({
      ...existing,
      name: imported.name,
      attribute: imported.attribute,
      description: imported.description,
    }),
  });

  const appliedItems = applyImportedEntries({
    existing: campaign.items,
    imported: preview.items,
    mode,
    merge: (existing, imported) => ({
      ...existing,
      name: imported.name,
      description: imported.description,
      isAttack: imported.isAttack,
    }),
  });

  const preSyncCampaign: CampaignDefinition = {
    ...campaign,
    powers: appliedPowers.entries,
    skills: appliedSkills.entries,
    items: appliedItems.entries,
    availablePowerIds: mergeAvailableIds(campaign.availablePowerIds, appliedPowers.addedIds),
    availableSkillIds: mergeAvailableIds(campaign.availableSkillIds, appliedSkills.addedIds),
    availableItemIds: mergeAvailableIds(campaign.availableItemIds, appliedItems.addedIds),
  };

  const warnings = [...preview.warnings];
  let updatedCampaign: CampaignDefinition = preSyncCampaign;
  const beforeAttackIds = new Set(preSyncCampaign.attackTemplates.map((attack) => attack.id));

  try {
    updatedCampaign = syncCampaignDerivedAttackTemplates(preSyncCampaign);
  } catch {
    warnings.push({
      code: "attack-sync-failed",
      message: "Attack creation failed during import. Powers, skills, and items were still imported.",
    });
  }

  const newlyCreatedAttackIds = new Set(
    updatedCampaign.attackTemplates
      .filter((attack) => !beforeAttackIds.has(attack.id))
      .map((attack) => attack.id)
  );

  if (newlyCreatedAttackIds.size > 0) {
    updatedCampaign = {
      ...updatedCampaign,
      attackTemplates: updatedCampaign.attackTemplates.map((attack) => {
        if (!newlyCreatedAttackIds.has(attack.id)) return attack;

        if (attack.derivedFromType === "power" && attack.derivedFromId) {
          const sourcePower = updatedCampaign.powers.find((entry) => entry.id === attack.derivedFromId);
          const hintedAttribute = sourcePower
            ? preview.attackAttributeHintsByName.powers[normalizeImportName(sourcePower.name)]
            : undefined;
          const inferredAttribute = inferAttackAttributeFromDescription(sourcePower?.description);
          const nextAttribute = hintedAttribute ?? sourcePower?.saveAttribute ?? inferredAttribute;
          return nextAttribute ? { ...attack, attribute: nextAttribute } : attack;
        }

        if (attack.derivedFromType === "item" && attack.derivedFromId) {
          const sourceItem = updatedCampaign.items.find((entry) => entry.id === attack.derivedFromId);
          const hintedAttribute = sourceItem
            ? preview.attackAttributeHintsByName.items[normalizeImportName(sourceItem.name)]
            : undefined;
          const inferredAttribute = inferAttackAttributeFromDescription(sourceItem?.description);
          const nextAttribute = hintedAttribute ?? inferredAttribute;
          return nextAttribute ? { ...attack, attribute: nextAttribute } : attack;
        }

        return attack;
      }),
    };
  }

  const attacksCreated = newlyCreatedAttackIds.size;

  return {
    campaign: updatedCampaign,
    importedCounts: {
      powers: appliedPowers.appliedCount,
      skills: appliedSkills.appliedCount,
      items: appliedItems.appliedCount,
      attacks: attacksCreated,
    },
    skippedDuplicates:
      appliedPowers.skippedDuplicates +
      appliedSkills.skippedDuplicates +
      appliedItems.skippedDuplicates,
    warnings,
  };
}