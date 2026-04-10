import type { CampaignDefinition } from "../types/gameData";

export type DerivedAttackSourceType = "power" | "item";

export type DerivedAttackSource = {
  type: DerivedAttackSourceType;
  id: string;
  name: string;
};

export const DERIVED_ATTACK_DEFAULTS = {
  attribute: "STR" as const,
  damage: "1d6",
  bonus: 0,
};

function getDerivedKey(type: DerivedAttackSourceType, id: string) {
  return `${type}:${id}`;
}

export function getCampaignDerivedAttackSources(campaign: CampaignDefinition): DerivedAttackSource[] {
  const powerSources = campaign.powers
    .filter((power) => Boolean(power.isAttack))
    .map((power) => ({
      type: "power" as const,
      id: power.id,
      name: power.name,
    }));

  const itemSources = campaign.items
    .filter((item) => Boolean(item.isAttack))
    .map((item) => ({
      type: "item" as const,
      id: item.id,
      name: item.name,
    }));

  return [...powerSources, ...itemSources];
}

export function getSelectedDerivedAttackSources(
  campaign: CampaignDefinition,
  selectedPowerIds: Set<string>,
  selectedItemIds: Set<string>
): DerivedAttackSource[] {
  return getCampaignDerivedAttackSources(campaign).filter((source) =>
    source.type === "power" ? selectedPowerIds.has(source.id) : selectedItemIds.has(source.id)
  );
}

export function findDerivedAttackTemplate(
  campaign: CampaignDefinition,
  type: DerivedAttackSourceType,
  id: string
) {
  return campaign.attackTemplates.find(
    (attack) => attack.derivedFromType === type && attack.derivedFromId === id
  );
}

export function syncCampaignDerivedAttackTemplates(campaign: CampaignDefinition): CampaignDefinition {
  const desiredDerivedSources = getCampaignDerivedAttackSources(campaign);
  const desiredByKey = new Map(
    desiredDerivedSources.map((source) => [getDerivedKey(source.type, source.id), source])
  );
  const seenKeys = new Set<string>();
  const nextAttackTemplates = [] as CampaignDefinition["attackTemplates"];

  for (const attack of campaign.attackTemplates) {
    if (attack.derivedFromType && attack.derivedFromId) {
      const key = getDerivedKey(attack.derivedFromType, attack.derivedFromId);
      const source = desiredByKey.get(key);
      if (!source || seenKeys.has(key)) {
        continue;
      }

      nextAttackTemplates.push({
        ...attack,
        name: attack.name || source.name,
      });
      seenKeys.add(key);
      continue;
    }

    nextAttackTemplates.push(attack);
  }

  for (const source of desiredDerivedSources) {
    const key = getDerivedKey(source.type, source.id);
    if (seenKeys.has(key)) continue;

    nextAttackTemplates.push({
      id: `attack-${crypto.randomUUID()}`,
      derivedFromType: source.type,
      derivedFromId: source.id,
      name: source.name,
      attribute: DERIVED_ATTACK_DEFAULTS.attribute,
      damage: DERIVED_ATTACK_DEFAULTS.damage,
      bonus: DERIVED_ATTACK_DEFAULTS.bonus,
      notes: "",
      tags: [],
    });
    seenKeys.add(key);
  }

  const availableAttackTemplateIds = campaign.availableAttackTemplateIds
    ? Array.from(
        new Set([
          ...campaign.availableAttackTemplateIds.filter((id) =>
            nextAttackTemplates.some((attack) => attack.id === id)
          ),
          ...nextAttackTemplates.map((attack) => attack.id),
        ])
      )
    : campaign.availableAttackTemplateIds;

  return {
    ...campaign,
    attackTemplates: nextAttackTemplates,
    availableAttackTemplateIds,
  };
}
