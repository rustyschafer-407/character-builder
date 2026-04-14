import { campaigns } from "./campaigns";
import type { CampaignDefinition, GameData } from "../types/gameData";
import { normalizeCampaignDefinition } from "../lib/domain";

function normalizeGameData(value: { campaigns: CampaignDefinition[] }): GameData {
  const campaigns = value.campaigns.map((campaign) => normalizeCampaignDefinition(campaign));

  return {
    campaigns,
    classes: campaigns.flatMap((campaign) => campaign.classes).filter(Boolean),
    races: campaigns.flatMap((campaign) => campaign.races ?? []).filter(Boolean),
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
