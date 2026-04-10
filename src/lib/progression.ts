import { getAttributeModifier } from "./character";
import type { CharacterRecord } from "../types/character";
import type {
  ClassLevelProgressionRow,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  LevelProgressionHpGainMode,
} from "../types/gameData";

export function getAllowedSkillIdsForLevelUp(classRules: {
  levelUpSkillChoiceRules?: ClassSkillChoiceRule[];
  skillChoiceRules?: ClassSkillChoiceRule[];
}) {
  const levelUpRules = classRules.levelUpSkillChoiceRules ?? [];
  if (levelUpRules.length > 0) {
    return new Set(levelUpRules.flatMap((rule) => rule.skillIds));
  }

  const baseRules = classRules.skillChoiceRules ?? [];
  if (baseRules.length > 0) {
    return new Set(baseRules.flatMap((rule) => rule.skillIds));
  }

  return null;
}

export function getAllowedPowerIdsForLevelUp(classRules: {
  levelUpPowerChoiceRules?: ClassPowerChoiceRule[];
  powerChoiceRules?: ClassPowerChoiceRule[];
}) {
  const levelUpRules = classRules.levelUpPowerChoiceRules ?? [];
  if (levelUpRules.length > 0) {
    return new Set(levelUpRules.flatMap((rule) => rule.powerIds));
  }

  const baseRules = classRules.powerChoiceRules ?? [];
  if (baseRules.length > 0) {
    return new Set(baseRules.flatMap((rule) => rule.powerIds));
  }

  return null;
}

export function getNextLevelProgressionRow(
  character: CharacterRecord,
  classLevelProgression: ClassLevelProgressionRow[]
) {
  const nextLevel = character.level + 1;
  return classLevelProgression.find((row) => row.level === nextLevel) ?? null;
}

export function buildMissingProgressionMessage(
  className: string,
  currentLevel: number,
  classLevelProgression: ClassLevelProgressionRow[]
) {
  const nextLevel = currentLevel + 1;
  const higherLevels = classLevelProgression
    .map((row) => row.level)
    .filter((level) => level > currentLevel)
    .sort((a, b) => a - b);

  if (higherLevels.length === 0) {
    return `No progression rows are defined above level ${currentLevel} for ${className}. Add a row for level ${nextLevel} in Admin before leveling up.`;
  }

  return `No progression row is defined for ${className} at level ${nextLevel}. The next configured progression row is level ${higherLevels[0]}. Add level ${nextLevel} in Admin before leveling up.`;
}

function getFixedAverageHpGain(hitDie: number) {
  return Math.floor(hitDie / 2) + 1;
}

function rollHitDie(hitDie: number) {
  return Math.floor(Math.random() * hitDie) + 1;
}

export function getLevelUpHpGain(
  character: CharacterRecord,
  hitDie: number,
  rowHpGainMode: LevelProgressionHpGainMode | undefined,
  levelUpMode: "fixed-average" | "fixed-value" | "roll",
  levelUpFixedValue: number | undefined,
  hitDiceGained: number
) {
  if (hitDiceGained <= 0) return 0;

  const conMod = getAttributeModifier(character.attributes.CON);
  let total = 0;

  for (let i = 0; i < hitDiceGained; i += 1) {
    let perDieBase = getFixedAverageHpGain(hitDie);

    if (rowHpGainMode === "full") {
      perDieBase = hitDie;
    } else if (rowHpGainMode === "half") {
      perDieBase = getFixedAverageHpGain(hitDie);
    } else if (rowHpGainMode === "random") {
      perDieBase = rollHitDie(hitDie);
    } else if (levelUpMode === "fixed-value" && Number.isFinite(levelUpFixedValue)) {
      perDieBase = Math.max(1, Number(levelUpFixedValue));
    } else if (levelUpMode === "roll") {
      perDieBase = rollHitDie(hitDie);
    }

    total += Math.max(1, perDieBase + conMod);
  }

  return total;
}
