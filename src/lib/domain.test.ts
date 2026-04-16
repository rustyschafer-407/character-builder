import { describe, expect, it } from "vitest";
import type { CampaignDefinition } from "../types/gameData";
import { normalizeCampaignDefinition } from "./domain";

function makeCampaign(overrides?: Partial<CampaignDefinition>): CampaignDefinition {
  return {
    id: "campaign-1",
    name: "Test Campaign",
    description: "",
    labels: {
      attributes: "Attributes",
      skills: "Skills",
      attacks: "Attacks",
      powers: "Powers",
      inventory: "Inventory",
      className: "Class",
      level: "Level",
      hp: "HP",
    },
    attributeRules: {
      generationMethods: ["pointBuy", "randomRoll", "manual"],
      pointBuyTotal: 27,
      randomRollFormula: "4d6 drop lowest",
      randomRollCount: 6,
      randomRollDropLowest: 1,
      minimumScore: 3,
      maximumScore: 18,
    },
    classes: [],
    races: [],
    skills: [],
    powers: [],
    items: [],
    attackTemplates: [],
    ...overrides,
  };
}

describe("normalizeCampaignDefinition", () => {
  it("defaults legacy campaigns to point buy first", () => {
    const normalized = normalizeCampaignDefinition(
      makeCampaign({
        attributeRules: undefined as never,
      })
    );

    expect(normalized.attributeRules.generationMethods).toEqual(["pointBuy", "randomRoll", "manual"]);
    expect(normalized.attributeRules.pointBuyTotal).toBe(27);
  });

  it("defaults empty generation methods to point buy first", () => {
    const normalized = normalizeCampaignDefinition(
      makeCampaign({
        attributeRules: {
          generationMethods: [],
        },
      })
    );

    expect(normalized.attributeRules.generationMethods[0]).toBe("pointBuy");
  });
});