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
  availableClassIds: ["pilot", "engineer"],
  availableSkillIds: [
    "piloting",
    "engineering",
    "hacking",
    "perception-scifi",
    "survival-scifi",
    "command",
    "intimidation",
  ],
  availablePowerIds: ["target-lock", "field-repair", "overcharge"],
  availableItemIds: ["medkit", "power-cell", "grapnel", "ration-pack"],
  availableAttackTemplateIds: ["blaster", "rifle"],
  attributeRules: {
    generationMethods: ["pointBuy", "randomRoll", "manual"],
    pointBuyTotal: 27,
    randomRollFormula: "4d6 drop lowest",
    randomRollCount: 6,
    randomRollDropLowest: 1,
    minimumScore: 3,
    maximumScore: 18,
  },
};