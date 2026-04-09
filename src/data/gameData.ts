import { campaigns } from "./campaigns";
import type { CampaignDefinition, ClassDefinition, GameData } from "../types/gameData";

function makeDefaultLevelProgression(cls: ClassDefinition) {
  const skillChoices = (cls.skillChoiceRules ?? []).reduce((sum, rule) => sum + rule.choose, 0);
  const powerChoices = (cls.powerChoiceRules ?? []).reduce((sum, rule) => sum + rule.choose, 0);

  return [
    {
      level: 1,
      hitDiceGained: 1,
      newSkillChoices: skillChoices,
      newPowerChoices: powerChoices,
      attributeBonuses: cls.attributeBonuses ?? [],
    },
  ];
}

function normalizeGameData(value: { campaigns: CampaignDefinition[] }): GameData {
  const campaigns = value.campaigns.map((campaign) => ({
    ...campaign,
    classes: campaign.classes.map((cls) => ({
      ...cls,
      levelProgression: cls.levelProgression ?? makeDefaultLevelProgression(cls),
    })),
    availableClassIds: campaign.availableClassIds ?? campaign.classes.map((cls) => cls.id),
    availableSkillIds: campaign.availableSkillIds ?? campaign.skills.map((skill) => skill.id),
    availablePowerIds: campaign.availablePowerIds ?? campaign.powers.map((power) => power.id),
    availableItemIds: campaign.availableItemIds ?? campaign.items.map((item) => item.id),
    availableAttackTemplateIds:
      campaign.availableAttackTemplateIds ?? campaign.attackTemplates.map((attack) => attack.id),
  }));

  return {
    campaigns,
    classes: campaigns.flatMap((campaign) => campaign.classes).filter(Boolean),
    skills: campaigns.flatMap((campaign) => campaign.skills).filter(Boolean),
    powers: campaigns.flatMap((campaign) => campaign.powers).filter(Boolean),
    items: campaigns.flatMap((campaign) => campaign.items).filter(Boolean),
    attackTemplates: campaigns.flatMap((campaign) => campaign.attackTemplates).filter(Boolean),
  };
}

export const gameData: GameData = normalizeGameData({ campaigns });

export function createGameData(value: { campaigns: CampaignDefinition[] }): GameData {
  return normalizeGameData(value);
}
