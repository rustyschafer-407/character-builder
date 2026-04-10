import type {
  CharacterAttack,
  CharacterItem,
  CharacterPowerSelection,
} from "../types/character";
import type { CampaignDefinition } from "../types/gameData";
import {
  DERIVED_ATTACK_DEFAULTS,
  findDerivedAttackTemplate,
  getSelectedDerivedAttackSources,
  type DerivedAttackSourceType,
} from "./derivedAttacks";

type DesiredDerivedAttack = {
  type: DerivedAttackSourceType;
  id: string;
  name: string;
  template?: CampaignDefinition["attackTemplates"][number];
};

type AttackSyncInput = {
  powers: CharacterPowerSelection[];
  inventory: CharacterItem[];
  attacks: CharacterAttack[];
};

function getDerivedKey(type: DerivedAttackSourceType, id: string) {
  return `${type}:${id}`;
}

function createDerivedAttack(source: DesiredDerivedAttack): CharacterAttack {
  const template = source.template;

  return {
    id: crypto.randomUUID(),
    derivedFromType: source.type,
    derivedFromId: source.id,
    templateId: template?.id,
    name: template?.name ?? source.name,
    attribute: template?.attribute ?? DERIVED_ATTACK_DEFAULTS.attribute,
    damage: template?.damage ?? DERIVED_ATTACK_DEFAULTS.damage,
    bonus: template?.bonus ?? DERIVED_ATTACK_DEFAULTS.bonus,
    damageBonus: 0,
    notes: template?.notes ?? "",
  };
}

function getDesiredDerivedAttacks(input: AttackSyncInput, campaign: CampaignDefinition): DesiredDerivedAttack[] {
  const selectedPowerIds = new Set(
    input.powers
      .map((power) => power.powerId)
      .filter((powerId): powerId is string => typeof powerId === "string")
  );

  const selectedItemIds = new Set(
    input.inventory
      .map((item) => item.itemId)
      .filter((itemId): itemId is string => typeof itemId === "string")
  );

  const selectedSources = getSelectedDerivedAttackSources(
    campaign,
    selectedPowerIds,
    selectedItemIds
  );

  return selectedSources.map((source) => ({
    ...source,
    template: findDerivedAttackTemplate(campaign, source.type, source.id),
  }));
}

export function syncDerivedAttacks(
  input: AttackSyncInput,
  campaign: CampaignDefinition
): CharacterAttack[] {
  const desiredDerivedAttacks = getDesiredDerivedAttacks(input, campaign);
  const desiredKeySet = new Set(
    desiredDerivedAttacks.map((attack) => getDerivedKey(attack.type, attack.id))
  );
  const seenKeys = new Set<string>();

  const nextAttacks: CharacterAttack[] = [];

  for (const attack of input.attacks) {
    let normalizedAttack = attack;

    if (!attack.derivedFromType && !attack.derivedFromId && attack.templateId) {
      const derivedTemplate = campaign.attackTemplates.find(
        (template) =>
          template.id === attack.templateId &&
          (template.derivedFromType === "power" || template.derivedFromType === "item") &&
          typeof template.derivedFromId === "string"
      );

      if (derivedTemplate?.derivedFromType && derivedTemplate.derivedFromId) {
        normalizedAttack = {
          ...attack,
          derivedFromType: derivedTemplate.derivedFromType,
          derivedFromId: derivedTemplate.derivedFromId,
        };
      }
    }

    if (normalizedAttack.derivedFromType && normalizedAttack.derivedFromId) {
      const key = getDerivedKey(normalizedAttack.derivedFromType, normalizedAttack.derivedFromId);
      if (!desiredKeySet.has(key) || seenKeys.has(key)) {
        continue;
      }
      nextAttacks.push(normalizedAttack);
      seenKeys.add(key);
      continue;
    }

    nextAttacks.push(normalizedAttack);
  }

  for (const desiredAttack of desiredDerivedAttacks) {
    const key = getDerivedKey(desiredAttack.type, desiredAttack.id);
    if (seenKeys.has(key)) continue;

    nextAttacks.push(createDerivedAttack(desiredAttack));
    seenKeys.add(key);
  }

  return nextAttacks;
}
