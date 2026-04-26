import { describe, expect, it } from "vitest";
import { createCharacterFromCampaignAndClass, getAttributeModifier } from "./character";

describe("getAttributeModifier", () => {
  it("matches the standard attribute modifier chart", () => {
    const expectedByScore = new Map([
      [1, -5],
      [2, -4],
      [3, -4],
      [4, -3],
      [5, -3],
      [6, -2],
      [7, -2],
      [8, -1],
      [9, -1],
      [10, 0],
      [11, 0],
      [12, 1],
      [13, 1],
      [14, 2],
      [15, 2],
      [16, 3],
      [17, 3],
      [18, 4],
      [19, 4],
      [20, 5],
    ]);

    for (const [score, expectedModifier] of expectedByScore) {
      expect(getAttributeModifier(score)).toBe(expectedModifier);
    }
  });
});

describe("createCharacterFromCampaignAndClass", () => {
  it("does not reduce first-level HP below the class hit die", () => {
    const character = createCharacterFromCampaignAndClass(
      {
        id: "campaign-1",
        name: "Gamma Test",
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
          generationMethods: ["manual"],
        },
        classes: [],
        races: [],
        skills: [],
        powers: [],
        items: [],
        attackTemplates: [],
      } as any,
      {
        id: "class-1",
        name: "Scout",
        hpRule: { hitDie: 8 },
      } as any,
      "Low Con Hero",
      {
        id: "race-1",
        name: "Shriveled",
        availableClassIds: [],
        attributeBonuses: [{ attribute: "CON", amount: -2 }],
      } as any
    );

    expect(character.hp.max).toBe(8);
    expect(character.hp.current).toBe(8);
  });
});
