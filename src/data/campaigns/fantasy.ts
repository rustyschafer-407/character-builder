import type { CampaignDefinition } from "../../types/gameData";

export const fantasyCampaign: CampaignDefinition = {
  id: "fantasy",
  name: "Fantasy",
  description: "Classic fantasy adventuring.",
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
  classes: [
    {
      id: "fighter",
      campaignId: "fantasy",
      name: "Fighter",
      attributeBonuses: [{ attribute: "STR", amount: 2 }],
      hpRule: {
        hitDie: 10,
        level1Mode: "fixed-max",
        levelUpMode: "fixed-average",
        level1FixedValue: 6,
      },
      levelProgression: [
        {
          level: 1,
          hitDiceGained: 1,
          newSkillChoices: 2,
          newPowerChoices: 0,
          attributeBonuses: [{ attribute: "STR", amount: 2 }],
        },
      ],
      startingAttackTemplateIds: ["sword"],
      skillChoiceRules: [
        { choose: 2, skillIds: ["athletics", "survival", "perception"] },
      ],
    },
    {
      id: "wizard",
      campaignId: "fantasy",
      name: "Wizard",
      attributeBonuses: [{ attribute: "INT", amount: 2 }],
      hpRule: {
        hitDie: 6,
        level1Mode: "fixed-max",
        levelUpMode: "fixed-average",
        level1FixedValue: 4,
      },
      levelProgression: [
        {
          level: 1,
          hitDiceGained: 1,
          newSkillChoices: 2,
          newPowerChoices: 0,
          attributeBonuses: [{ attribute: "INT", amount: 2 }],
        },
      ],
      defaultPowerIds: ["arcane-bolt"],
      skillChoiceRules: [
        { choose: 2, skillIds: ["lore", "investigation", "perception"] },
      ],
    },
  ],
  skills: [
    { id: "athletics", name: "Athletics", attribute: "STR" },
    { id: "acrobatics", name: "Acrobatics", attribute: "DEX" },
    { id: "stealth", name: "Stealth", attribute: "DEX" },
    { id: "lore", name: "Lore", attribute: "INT" },
    { id: "investigation", name: "Investigation", attribute: "INT" },
    { id: "perception", name: "Perception", attribute: "WIS" },
    { id: "survival", name: "Survival", attribute: "WIS" },
    { id: "presence", name: "Presence", attribute: "CHA" },
  ],
  powers: [
    { id: "second-wind", name: "Second Wind" },
    { id: "backstab", name: "Backstab" },
    { id: "arcane-bolt", name: "Arcane Bolt" },
  ],
  items: [
    { id: "rope", name: "Rope", stackable: false },
    { id: "rations", name: "Rations", stackable: false, defaultQuantity: 1 },
    { id: "torch", name: "Torch", stackable: false },
    { id: "healing-potion", name: "Healing Potion", stackable: false },
  ],
  attackTemplates: [
    { id: "sword", name: "Sword", attribute: "STR", damage: "1d8" },
    { id: "bow", name: "Bow", attribute: "DEX", damage: "1d6" },
  ],
};
