import { getRuleForItem, getRuleForPower, getRuleForSkill, getSelectedCountForItemRule, getSelectedCountForPowerRule, getSelectedCountForSkillRule } from "../lib/creationChoiceRules";
import { syncDerivedAttacks } from "../lib/attackSync";
import { getFirstVisibleCharacterId } from "../lib/campaigns";
import type { CharacterRecord } from "../types/character";
import type { AttributeKey, CampaignDefinition, ClassDefinition } from "../types/gameData";

interface UseCharacterEditorParams {
  characters: CharacterRecord[];
  selectedId: string;
  campaignId: string;
  selectedCampaign: CampaignDefinition | null;
  selectedClass: ClassDefinition | null;
  getPointBuySpent: (attributes: Record<AttributeKey, number>) => number;
  updateCharacter: (updated: CharacterRecord) => void;
  setCharacters: (updater: (previous: CharacterRecord[]) => CharacterRecord[]) => void;
  setSelectedId: (nextId: string) => void;
}

export function useCharacterEditor({
  characters,
  selectedId,
  campaignId,
  selectedCampaign,
  selectedClass,
  getPointBuySpent,
  updateCharacter,
  setCharacters,
  setSelectedId,
}: UseCharacterEditorParams) {
  function updateAttributeWithRules(character: CharacterRecord, key: AttributeKey, value: number) {
    const method = character.attributeGeneration?.method ?? "manual";

    if (method === "pointBuy") {
      const clamped = Math.max(8, Math.min(15, value));

      const nextAttributes = {
        ...character.attributes,
        [key]: clamped,
      };

      const totalAllowed = character.attributeGeneration?.pointBuyTotal ?? 27;
      const spent = getPointBuySpent(nextAttributes);

      if (spent > totalAllowed) return;

      updateCharacter({
        ...character,
        attributes: nextAttributes,
      });
      return;
    }

    updateCharacter({
      ...character,
      attributes: {
        ...character.attributes,
        [key]: value,
      },
    });
  }

  function updateSkillWithRules(
    character: CharacterRecord,
    field: "proficient" | "bonus",
    skillId: string,
    value: boolean | number
  ) {
    if (field === "bonus") {
      updateCharacter({
        ...character,
        skills: character.skills.map((skill) =>
          skill.skillId === skillId ? { ...skill, bonus: value as number } : skill
        ),
      });
      return;
    }

    const nextProficient = value as boolean;
    const rules = selectedClass?.skillChoiceRules ?? [];

    if (nextProficient) {
      if (rules.length > 0) {
        const rule = getRuleForSkill(skillId, rules);
        if (!rule) {
          alert("That skill cannot be chosen for this class.");
          return;
        }

        const selectedCount = getSelectedCountForSkillRule(rule, character.skills);
        if (selectedCount >= rule.choose) {
          alert("You have already selected the maximum number of skill proficiencies for that group.");
          return;
        }
      }

      updateCharacter({
        ...character,
        skills: character.skills.map((skill) =>
          skill.skillId === skillId
            ? { ...skill, proficient: true, source: "wizard-choice" }
            : skill
        ),
      });
      return;
    }

    updateCharacter({
      ...character,
      skills: character.skills.map((skill) =>
        skill.skillId === skillId ? { ...skill, proficient: false } : skill
      ),
    });
  }

  function togglePowerWithRules(character: CharacterRecord, powerId: string, nextSelected: boolean) {
    if (!selectedCampaign) return;
    const power = selectedCampaign?.powers.find((p) => p.id === powerId);
    if (!power) return;

    const rules = selectedClass?.powerChoiceRules ?? [];

    if (nextSelected) {
      const alreadySelected = character.powers.some((p) => p.powerId === powerId);
      if (alreadySelected) return;

      if (rules.length > 0) {
        const rule = getRuleForPower(powerId, rules);
        if (!rule) {
          alert("That power cannot be chosen for this class.");
          return;
        }

        const selectedCount = getSelectedCountForPowerRule(rule, character.powers);
        if (selectedCount >= rule.choose) {
          alert("You have already selected the maximum number of powers for that group.");
          return;
        }
      }

      updateCharacter({
        ...character,
        powers: [
          ...character.powers,
          {
            powerId: power.id,
            name: power.name,
            notes: power.description,
            source: "wizard-choice",
            usesPerDay: power.usesPerDay,
            description: power.description,
            saveAttribute: power.saveAttribute,
          },
        ],
        attacks: syncDerivedAttacks(
          {
            ...character,
            powers: [
              ...character.powers,
              {
                powerId: power.id,
                name: power.name,
                notes: power.description,
                source: "wizard-choice",
                usesPerDay: power.usesPerDay,
                description: power.description,
                saveAttribute: power.saveAttribute,
              },
            ],
          },
          selectedCampaign
        ),
      });
      return;
    }

    const nextPowers = character.powers.filter((p) => p.powerId !== powerId);
    updateCharacter({
      ...character,
      powers: nextPowers,
      attacks: syncDerivedAttacks(
        {
          ...character,
          powers: nextPowers,
        },
        selectedCampaign
      ),
    });
  }

  function updatePowerWithRules(
    character: CharacterRecord,
    field: "usesPerDay" | "description" | "saveAttribute",
    powerId: string,
    value: number | string | AttributeKey | undefined
  ) {
    updateCharacter({
      ...character,
      powers: character.powers.map((power) => {
        if (power.powerId !== powerId) return power;
        if (field === "usesPerDay") {
          return { ...power, usesPerDay: value as number };
        }
        if (field === "description") {
          return { ...power, description: value as string };
        }
        if (field === "saveAttribute") {
          return { ...power, saveAttribute: value as AttributeKey | undefined };
        }
        return power;
      }),
    });
  }

  function toggleItemWithRules(character: CharacterRecord, itemId: string, nextSelected: boolean) {
    if (!selectedCampaign) return;
    const item = selectedCampaign?.items.find((i) => i.id === itemId);
    if (!item) return;

    const rules = selectedClass?.itemChoiceRules ?? [];

    if (nextSelected) {
      const alreadySelected = character.inventory.some((i) => i.itemId === itemId);
      if (alreadySelected) return;

      if (rules.length > 0) {
        const rule = getRuleForItem(itemId, rules);
        if (!rule) {
          alert("That item cannot be chosen for this class.");
          return;
        }

        const selectedCount = getSelectedCountForItemRule(rule, character.inventory);
        if (selectedCount >= rule.choose) {
          alert("You have already selected the maximum number of items for that group.");
          return;
        }
      }

      updateCharacter({
        ...character,
        inventory: [
          ...character.inventory,
          {
            itemId: item.id,
            name: item.name,
            quantity: item.defaultQuantity ?? 1,
            notes: item.description,
            equipped: false,
            source: "wizard-choice",
          },
        ],
        attacks: syncDerivedAttacks(
          {
            ...character,
            inventory: [
              ...character.inventory,
              {
                itemId: item.id,
                name: item.name,
                quantity: item.defaultQuantity ?? 1,
                notes: item.description,
                equipped: false,
                source: "wizard-choice",
              },
            ],
          },
          selectedCampaign
        ),
      });
      return;
    }

    const nextInventory = character.inventory.filter((i) => i.itemId !== itemId);
    updateCharacter({
      ...character,
      inventory: nextInventory,
      attacks: syncDerivedAttacks(
        {
          ...character,
          inventory: nextInventory,
        },
        selectedCampaign
      ),
    });
  }

  function updateInventoryQuantity(character: CharacterRecord, itemKey: string, quantity: number) {
    updateCharacter({
      ...character,
      inventory: character.inventory.map((item) =>
        (item.itemId ?? item.name) === itemKey
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      ),
    });
  }

  function updateInventoryEquipped(character: CharacterRecord, itemKey: string, equipped: boolean) {
    updateCharacter({
      ...character,
      inventory: character.inventory.map((item) =>
        (item.itemId ?? item.name) === itemKey
          ? { ...item, equipped }
          : item
      ),
    });
  }

  function addManualItem(character: CharacterRecord) {
    updateCharacter({
      ...character,
      inventory: [
        ...character.inventory,
        {
          name: `Custom Item ${character.inventory.filter((i) => !i.itemId).length + 1}`,
          quantity: 1,
          equipped: false,
          source: "manual",
        },
      ],
    });
  }

  function removeManualItem(character: CharacterRecord, itemName: string) {
    updateCharacter({
      ...character,
      inventory: character.inventory.filter(
        (item) => !(item.source === "manual" && item.name === itemName)
      ),
    });
  }

  function deleteCharacter(id: string) {
    const character = characters.find((c) => c.id === id);
    const displayName = character?.identity.name?.trim() || "this character";

    const confirmed = window.confirm(`Delete ${displayName}? This cannot be undone.`);
    if (!confirmed) return;

    const remaining = characters.filter((c) => c.id !== id);
    setCharacters(() => remaining);

    if (
      selectedId &&
      (id === selectedId ||
        !remaining.some((remainingCharacter) => remainingCharacter.id === selectedId))
    ) {
      setSelectedId(getFirstVisibleCharacterId(remaining, campaignId));
    }
  }

  return {
    updateAttributeWithRules,
    updateSkillWithRules,
    togglePowerWithRules,
    updatePowerWithRules,
    toggleItemWithRules,
    updateInventoryQuantity,
    updateInventoryEquipped,
    addManualItem,
    removeManualItem,
    deleteCharacter,
  };
}
