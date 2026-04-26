import type { CampaignDefinition } from "../../types/gameData";

export const scifiCampaign: CampaignDefinition = {
  id: "scifi",
  name: "Sci-Fi",
  description: "Spacefaring heroes and future tech.",
  labels: {
    attributes: "Stats",
    skills: "Disciplines",
    attacks: "Weapons",
    powers: "Abilities",
    inventory: "Gear",
    className: "Role",
    level: "Rank",
    hp: "Vitality",
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
      id: "soldier",
      campaignId: "scifi",
      name: "Soldier",
      attributeBonuses: [{ attribute: "STR", amount: 1 }],
      hpRule: {
        hitDie: 10,
        hitDiceAtLevel1: 1,
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
          attributeBonuses: [{ attribute: "STR", amount: 1 }],
        },
      ],
      startingAttackTemplateIds: ["blaster"],
      skillChoiceRules: [
        { choose: 2, skillIds: ["command", "intimidation", "survival"] },
      ],
    },
    {
      id: "engineer",
      campaignId: "scifi",
      name: "Engineer",
      attributeBonuses: [{ attribute: "INT", amount: 2 }],
      hpRule: {
        hitDie: 6,
        hitDiceAtLevel1: 1,
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
      defaultPowerIds: ["shield"],
      skillChoiceRules: [
        { choose: 2, skillIds: ["engineering", "hacking", "perception"] },
      ],
    },
  ],
  skills: [
    { id: "piloting", name: "Piloting", attribute: "DEX" },
    { id: "engineering", name: "Engineering", attribute: "INT" },
    { id: "hacking", name: "Hacking", attribute: "INT" },
    { id: "perception-scifi", name: "Perception", attribute: "WIS" },
    { id: "survival-scifi", name: "Survival", attribute: "WIS" },
    { id: "command", name: "Command", attribute: "CHA" },
    { id: "intimidation", name: "Intimidation", attribute: "CHA" },
  ],
  powers: [
    { id: "target-lock", name: "Target Lock" },
    { id: "field-repair", name: "Field Repair" },
    { id: "overcharge", name: "Overcharge" },
  ],
  items: [
    { id: "medkit", name: "Medkit", stackable: false },
    { id: "power-cell", name: "Power Cell", stackable: false },
    { id: "grapnel", name: "Grapnel", stackable: false },
    { id: "ration-pack", name: "Ration Pack", stackable: false },
  ],
  attackTemplates: [
    { id: "blaster", name: "Blaster", attribute: "DEX", damage: "1d8" },
    { id: "rifle", name: "Rifle", attribute: "DEX", damage: "1d10" },
  ],
};
