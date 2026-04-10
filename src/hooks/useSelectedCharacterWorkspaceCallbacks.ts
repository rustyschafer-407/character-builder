import { generateId } from "../lib/character";
import type { CharacterRecord } from "../types/character";
import type { AttributeKey, CampaignDefinition } from "../types/gameData";

interface UseSelectedCharacterWorkspaceCallbacksParams {
  selected: CharacterRecord | null;
  selectedCampaign: CampaignDefinition | null;
  updateCharacter: (updated: CharacterRecord) => void;
  updateAttributeWithRules: (character: CharacterRecord, key: AttributeKey, value: number) => void;
  updateSkillWithRules: (
    character: CharacterRecord,
    field: "proficient" | "bonus",
    skillId: string,
    value: boolean | number
  ) => void;
  togglePowerWithRules: (character: CharacterRecord, powerId: string, nextSelected: boolean) => void;
  toggleItemWithRules: (character: CharacterRecord, itemId: string, nextSelected: boolean) => void;
  updateInventoryQuantity: (character: CharacterRecord, itemKey: string, quantity: number) => void;
  updateInventoryEquipped: (character: CharacterRecord, itemKey: string, equipped: boolean) => void;
  removeManualItem: (character: CharacterRecord, itemName: string) => void;
  addManualItem: (character: CharacterRecord) => void;
}

export function useSelectedCharacterWorkspaceCallbacks({
  selected,
  selectedCampaign,
  updateCharacter,
  updateAttributeWithRules,
  updateSkillWithRules,
  togglePowerWithRules,
  toggleItemWithRules,
  updateInventoryQuantity,
  updateInventoryEquipped,
  removeManualItem,
  addManualItem,
}: UseSelectedCharacterWorkspaceCallbacksParams) {
  function onNameChange(name: string) {
    if (!selected) return;

    updateCharacter({
      ...selected,
      identity: {
        ...selected.identity,
        name,
      },
    });
  }

  function onAttributeChange(key: AttributeKey, value: number) {
    if (!selected) return;
    updateAttributeWithRules(selected, key, value);
  }

  function onAttributeGenerationChange(method: "pointBuy" | "randomRoll" | "manual") {
    if (!selected || !selectedCampaign) return;

    updateCharacter({
      ...selected,
      attributeGeneration: {
        ...selected.attributeGeneration,
        method,
        pointBuyTotal:
          selected.attributeGeneration?.pointBuyTotal ??
          selectedCampaign.attributeRules.pointBuyTotal ??
          27,
      },
    });
  }

  function onApplyAttributeRolls(values: number[]) {
    if (!selected) return;

    const attrs: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    const newAttributes = { ...selected.attributes };

    attrs.forEach((attr, index) => {
      newAttributes[attr] = values[index];
    });

    updateCharacter({
      ...selected,
      attributes: newAttributes,
      attributeGeneration: {
        ...selected.attributeGeneration,
        method: "randomRoll",
        rolls: values,
      },
    });
  }

  function onSpeedChange(value: string) {
    if (!selected) return;
    updateCharacter({
      ...selected,
      sheet: { ...selected.sheet, speed: value },
    });
  }

  function onAcBaseChange(value: number) {
    if (!selected) return;
    updateCharacter({
      ...selected,
      sheet: { ...selected.sheet, acBase: value },
    });
  }

  function onAcBonusChange(value: number) {
    if (!selected) return;
    updateCharacter({
      ...selected,
      sheet: { ...selected.sheet, acBonus: value },
    });
  }

  function onAcUseDexChange(value: boolean) {
    if (!selected) return;
    updateCharacter({
      ...selected,
      sheet: { ...selected.sheet, acUseDex: value },
    });
  }

  function onInitMiscChange(value: number) {
    if (!selected) return;
    updateCharacter({
      ...selected,
      sheet: { ...selected.sheet, initMisc: value },
    });
  }

  function onSaveProfChange(attr: AttributeKey, value: boolean) {
    if (!selected) return;
    updateCharacter({
      ...selected,
      sheet: {
        ...selected.sheet,
        saveProf: {
          ...selected.sheet.saveProf,
          [attr]: value,
        },
      },
    });
  }

  function onSaveBonusChange(attr: AttributeKey, value: number) {
    if (!selected) return;
    updateCharacter({
      ...selected,
      sheet: {
        ...selected.sheet,
        saveBonus: {
          ...selected.sheet.saveBonus,
          [attr]: value,
        },
      },
    });
  }

  function onSkillChange(id: string, field: "proficient" | "bonus", value: boolean | number) {
    if (!selected) return;
    updateSkillWithRules(selected, field, id, value);
  }

  function onTogglePower(powerId: string, nextSelected: boolean) {
    if (!selected) return;
    togglePowerWithRules(selected, powerId, nextSelected);
  }

  function onToggleItem(itemId: string, nextSelected: boolean) {
    if (!selected) return;
    toggleItemWithRules(selected, itemId, nextSelected);
  }

  function onQuantityChange(itemKey: string, quantity: number) {
    if (!selected) return;
    updateInventoryQuantity(selected, itemKey, quantity);
  }

  function onEquippedChange(itemKey: string, equipped: boolean) {
    if (!selected) return;
    updateInventoryEquipped(selected, itemKey, equipped);
  }

  function onRemoveManualItem(itemName: string) {
    if (!selected) return;
    removeManualItem(selected, itemName);
  }

  function onAddManualItem() {
    if (!selected) return;
    addManualItem(selected);
  }

  function onAddAttack() {
    if (!selected) return;

    updateCharacter({
      ...selected,
      attacks: [
        ...selected.attacks,
        {
          id: generateId(),
          name: "New Attack",
          attribute: "STR",
          damage: "1d6",
          bonus: 0,
          damageBonus: 0,
        },
      ],
    });
  }

  function onAttackChange(id: string, field: "name" | "damage" | "bonus", value: string | number) {
    if (!selected) return;

    updateCharacter({
      ...selected,
      attacks: selected.attacks.map((attack) =>
        attack.id === id ? { ...attack, [field]: value } : attack
      ),
    });
  }

  return {
    onNameChange,
    onAttributeChange,
    onAttributeGenerationChange,
    onApplyAttributeRolls,
    onSpeedChange,
    onAcBaseChange,
    onAcBonusChange,
    onAcUseDexChange,
    onInitMiscChange,
    onSaveProfChange,
    onSaveBonusChange,
    onSkillChange,
    onTogglePower,
    onToggleItem,
    onQuantityChange,
    onEquippedChange,
    onRemoveManualItem,
    onAddManualItem,
    onAddAttack,
    onAttackChange,
  };
}
