import type { CharacterRecord } from "../types/character";
import { applySafeCharacterDefaults } from "../lib/domain";

const ATTRIBUTE_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;

function makeZeroAttributeMap() {
  return {
    STR: 0,
    DEX: 0,
    CON: 0,
    INT: 0,
    WIS: 0,
    CHA: 0,
  };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeNumberArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item))
    .map((item) => Math.max(1, Math.floor(item)));
}

function normalizeSkills(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is CharacterRecord["skills"][number] =>
      Boolean(item) && typeof item === "object" && typeof (item as { skillId?: unknown }).skillId === "string"
  );
}

function normalizePowers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is CharacterRecord["powers"][number] =>
      Boolean(item) && typeof item === "object" && typeof (item as { name?: unknown }).name === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizeCharacter(character: CharacterRecord): {
  character: CharacterRecord;
  droppedSkills: number;
  droppedPowers: number;
} {
  const safeCharacter = applySafeCharacterDefaults(character);
  const originalSkills = Array.isArray(safeCharacter.skills) ? safeCharacter.skills.length : 0;
  const originalPowers = Array.isArray(safeCharacter.powers) ? safeCharacter.powers.length : 0;
  const skills = normalizeSkills(safeCharacter.skills);
  const powers = normalizePowers(safeCharacter.powers);

  const level = Number.isFinite(safeCharacter.level)
    ? Math.max(1, Math.floor(safeCharacter.level))
    : 1;

  const fromSkills = skills
    .filter((skill) => skill.source === "level-up")
    .map((skill) => skill.skillId);

  const fromPowers = powers
    .filter((power) => power.source === "level-up" && power.powerId)
    .map((power) => power.powerId as string);

  const progression = safeCharacter.levelProgression;
  const normalizedAttributeIncreases = makeZeroAttributeMap();

  for (const key of ATTRIBUTE_KEYS) {
    const amount = progression?.appliedAttributeIncreases?.[key];
    normalizedAttributeIncreases[key] = Number.isFinite(amount)
      ? Number(amount)
      : 0;
  }

  return {
    character: {
      ...safeCharacter,
      level,
      skills,
      powers,
      levelProgression: {
        totalHitDice: Number.isFinite(progression?.totalHitDice)
          ? Math.max(0, Math.floor(progression.totalHitDice))
          : level,
        gainedSkillIds: Array.from(
          new Set(normalizeStringArray(progression?.gainedSkillIds).concat(fromSkills))
        ),
        gainedPowerIds: Array.from(
          new Set(normalizeStringArray(progression?.gainedPowerIds).concat(fromPowers))
        ),
        appliedLevels: Array.from(
          new Set(
            normalizeNumberArray(progression?.appliedLevels).concat(
              Array.from({ length: level }, (_value, index) => index + 1)
            )
          )
        ).sort((a, b) => a - b),
        appliedAttributeIncreases: normalizedAttributeIncreases,
      },
    },
    droppedSkills: Math.max(0, originalSkills - skills.length),
    droppedPowers: Math.max(0, originalPowers - powers.length),
  };
}

const STORAGE_KEY = "character-builder.characters";

export function loadCharacters(): CharacterRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const nextCharacters: CharacterRecord[] = [];
    let skippedRecords = 0;
    let droppedSkills = 0;
    let droppedPowers = 0;

    for (const item of parsed) {
      if (!isRecord(item)) {
        skippedRecords += 1;
        continue;
      }

      try {
        const normalized = normalizeCharacter(item as unknown as CharacterRecord);
        nextCharacters.push(normalized.character);
        droppedSkills += normalized.droppedSkills;
        droppedPowers += normalized.droppedPowers;
      } catch (error) {
        skippedRecords += 1;
        console.warn("Skipped invalid character record while loading storage", error);
      }
    }

    if (skippedRecords > 0) {
      console.warn("Skipped invalid character records while loading storage", { skippedRecords });
    }

    if (droppedSkills > 0 || droppedPowers > 0) {
      console.warn("Dropped invalid nested character fields while loading storage", {
        droppedSkills,
        droppedPowers,
      });
    }

    return nextCharacters;
  } catch (error) {
    console.error("Failed to parse saved characters", error);
    return [];
  }
}

export function saveCharacters(characters: CharacterRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
}