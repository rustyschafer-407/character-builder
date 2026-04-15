import type { AttributeKey } from "../types/gameData";

const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export type AttributeBonusSource = {
  attributeBonuses?: Array<{ attribute: AttributeKey; amount: number }>;
} | null;

export function makePointBuyBaseAttributes(): Record<AttributeKey, number> {
  return {
    STR: 8,
    DEX: 8,
    CON: 8,
    INT: 8,
    WIS: 8,
    CHA: 8,
  };
}

export function getPointBuyCost(baseScore: number) {
  if (baseScore < 8) return 0;
  if (baseScore > 15) return 9 + (baseScore - 15) * 2;
  return POINT_BUY_COSTS[baseScore] ?? 999;
}

export function getAttributeBonusTotals(
  cls: AttributeBonusSource,
  race: AttributeBonusSource
): Record<AttributeKey, number> {
  const totals: Record<AttributeKey, number> = {
    STR: 0,
    DEX: 0,
    CON: 0,
    INT: 0,
    WIS: 0,
    CHA: 0,
  };

  for (const bonus of cls?.attributeBonuses ?? []) {
    totals[bonus.attribute] += bonus.amount;
  }

  for (const bonus of race?.attributeBonuses ?? []) {
    totals[bonus.attribute] += bonus.amount;
  }

  return totals;
}

export function getPointBuyBaseScore(totalScore: number, totalBonus: number) {
  return totalScore - totalBonus;
}

export function getPointBuySpentFromTotals(
  attributes: Record<AttributeKey, number>,
  bonusTotals: Record<AttributeKey, number>
) {
  const keys: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  return keys.reduce((total, key) => {
    const baseScore = getPointBuyBaseScore(attributes[key], bonusTotals[key]);
    return total + getPointBuyCost(baseScore);
  }, 0);
}
