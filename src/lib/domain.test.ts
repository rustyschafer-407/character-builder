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

  it("preserves selected rule IDs when choose is zero", () => {
    const normalized = normalizeCampaignDefinition(
      makeCampaign({
        classes: [
          {
            id: "class-1",
            campaignId: "campaign-1",
            name: "Class One",
            description: "",
            attributeBonuses: [],
            hpRule: {
              hitDie: 8,
              level1Mode: "fixed-max",
              levelUpMode: "fixed-average",
            },
            levelProgression: [],
            skillChoiceRules: [{ choose: 0, skillIds: ["skill-1"] }],
            powerChoiceRules: [{ choose: 0, powerIds: ["power-1"] }],
            itemChoiceRules: [{ choose: 0, itemIds: ["item-1"] }],
            levelUpSkillChoiceRules: [{ choose: 0, skillIds: ["skill-1"] }],
            levelUpPowerChoiceRules: [{ choose: 0, powerIds: ["power-1"] }],
            levelUpItemChoiceRules: [{ choose: 0, itemIds: ["item-1"] }],
          },
        ],
        skills: [
          {
            id: "skill-1",
            name: "Skill One",
            attribute: "STR",
          },
        ],
        powers: [
          {
            id: "power-1",
            name: "Power One",
          },
        ],
        items: [
          {
            id: "item-1",
            name: "Item One",
            stackable: false,
          },
        ],
      })
    );

    const cls = normalized.classes[0];
    expect(cls.skillChoiceRules).toEqual([{ choose: 0, skillIds: ["skill-1"] }]);
    expect(cls.powerChoiceRules).toEqual([{ choose: 0, powerIds: ["power-1"] }]);
    expect(cls.itemChoiceRules).toEqual([{ choose: 0, itemIds: ["item-1"] }]);
    expect(cls.levelUpSkillChoiceRules).toEqual([{ choose: 0, skillIds: ["skill-1"] }]);
    expect(cls.levelUpPowerChoiceRules).toEqual([{ choose: 0, powerIds: ["power-1"] }]);
    expect(cls.levelUpItemChoiceRules).toEqual([{ choose: 0, itemIds: ["item-1"] }]);
  });
});
