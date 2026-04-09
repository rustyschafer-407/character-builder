import type { CharacterRecord } from "../types/character";

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

function normalizeCharacter(character: CharacterRecord): CharacterRecord {
  const skills = normalizeSkills(character.skills);
  const powers = normalizePowers(character.powers);

  const level = Number.isFinite(character.level)
    ? Math.max(1, Math.floor(character.level))
    : 1;

  const fromSkills = skills
    .filter((skill) => skill.source === "level-up")
    .map((skill) => skill.skillId);

  const fromPowers = powers
    .filter((power) => power.source === "level-up" && power.powerId)
    .map((power) => power.powerId as string);

  const progression = character.levelProgression;
  const normalizedAttributeIncreases = makeZeroAttributeMap();

  for (const key of ATTRIBUTE_KEYS) {
    const amount = progression?.appliedAttributeIncreases?.[key];
    normalizedAttributeIncreases[key] = Number.isFinite(amount)
      ? Number(amount)
      : 0;
  }

  return {
    ...character,
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
    return (parsed as CharacterRecord[]).map(normalizeCharacter);
  } catch (error) {
    console.error("Failed to parse saved characters", error);
    return [];
  }
}

export function saveCharacters(characters: CharacterRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
}