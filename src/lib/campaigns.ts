import type { CharacterRecord } from "../types/character";
import type { CampaignDefinition, GameData } from "../types/gameData";

export function makeBlankCampaign(): CampaignDefinition {
  return {
    id: `campaign-${Date.now()}`,
    name: "New Campaign",
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
    classes: [],
    races: [],
    skills: [],
    powers: [],
    items: [],
    attackTemplates: [],
    availableClassIds: [],
    availableRaceIds: [],
    availableSkillIds: [],
    availablePowerIds: [],
    availableItemIds: [],
    availableAttackTemplateIds: [],
    attributeRules: {
      generationMethods: ["manual"],
      pointBuyTotal: 27,
      randomRollFormula: "4d6 drop lowest",
      randomRollCount: 6,
      randomRollDropLowest: 1,
      minimumScore: 3,
      maximumScore: 18,
    },
  };
}

export function getFirstVisibleCharacterId(
  characters: CharacterRecord[],
  selectedCampaignId: string
) {
  return characters.find((character) => character.campaignId === selectedCampaignId)?.id ?? "";
}

export function resolveActiveCampaignId(gameData: GameData, preferredCampaignId: string) {
  return gameData.campaigns.some((campaign) => campaign.id === preferredCampaignId)
    ? preferredCampaignId
    : gameData.campaigns[0]?.id ?? "";
}
