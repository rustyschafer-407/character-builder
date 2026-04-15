import type { CharacterRecord } from "../types/character";
import type {
  AttributeBonusRule,
  AttributeKey,
  CampaignLabels,
  ItemDefinition,
  PowerDefinition,
  SkillDefinition,
} from "../types/gameData";
import IdentitySection from "./IdentitySection";
import AttributesSection from "./AttributesSection";
import SheetFieldsSection from "./SheetFieldsSection";
import SkillsSection from "./SkillsSection";
import PowersSection from "./PowersSection";
import InventorySection from "./InventorySection";
import AttacksSection from "./AttacksSection";
import LevelUpWizard from "./LevelUpWizard";
import Roll20ExportPanel from "./Roll20ExportPanel";

interface SelectedCharacterWorkspaceProps {
  character: CharacterRecord;
  selectedCampaignName: string;
  selectedRaceName: string;
  selectedClassName: string;
  labels: CampaignLabels;
  selectedSkills: SkillDefinition[];
  selectedPowers: PowerDefinition[];
  selectedItems: ItemDefinition[];
  chatSetAttrCommand: string;
  roll20Phase1Command: string;
  roll20Phase2Command: string;
  levelUpOpen: boolean;
  levelUpApplyPending: boolean;
  levelUpSkillSelections: string[];
  levelUpPowerSelections: string[];
  levelUpMissingRowMessage: string | null;
  nextLevel: number;
  nextHitDiceGained: number;
  nextAttributeBonuses: AttributeBonusRule[];
  nextNewSkillChoices: number;
  nextNewPowerChoices: number;
  nextProficiencyBonus?: number;
  availableLevelUpSkills: SkillDefinition[];
  availableLevelUpPowers: PowerDefinition[];
  onOpenLevelUpWizard: () => void;
  onToggleLevelUpSkill: (skillId: string, nextSelected: boolean) => void;
  onToggleLevelUpPower: (powerId: string, nextSelected: boolean) => void;
  onCloseLevelUpWizard: () => void;
  onApplyLevelUp: () => void;
  onNameChange: (name: string) => void;
  onAttributeChange: (k: AttributeKey, v: number) => void;
  onSpeedChange: (value: string) => void;
  onAcBaseChange: (value: number) => void;
  onAcBonusChange: (value: number) => void;
  onAcUseDexChange: (value: boolean) => void;
  onInitMiscChange: (value: number) => void;
  onSaveProfChange: (attr: AttributeKey, value: boolean) => void;
  onSaveBonusChange: (attr: AttributeKey, value: number) => void;
  onSkillChange: (id: string, field: "proficient" | "bonus", value: boolean | number) => void;
  onTogglePower: (powerId: string, nextSelected: boolean) => void;
  onPowerChange?: (
    powerId: string,
    field: "usesPerDay" | "description" | "saveAttribute",
    value: number | string | AttributeKey | undefined
  ) => void;
  onToggleItem: (itemId: string, nextSelected: boolean) => void;
  onQuantityChange: (itemKey: string, quantity: number) => void;
  onEquippedChange: (itemKey: string, equipped: boolean) => void;
  onRemoveManualItem: (itemName: string) => void;
  onAddManualItem: () => void;
  onAddAttack: () => void;
  onAttackChange: (id: string, field: "name" | "damage" | "bonus", value: string | number) => void;
}

export default function SelectedCharacterWorkspace({
  character,
  selectedCampaignName,
  selectedRaceName,
  selectedClassName,
  labels,
  selectedSkills,
  selectedPowers,
  selectedItems,
  chatSetAttrCommand,
  roll20Phase1Command,
  roll20Phase2Command,
  levelUpOpen,
  levelUpApplyPending,
  levelUpSkillSelections,
  levelUpPowerSelections,
  levelUpMissingRowMessage,
  nextLevel,
  nextHitDiceGained,
  nextAttributeBonuses,
  nextNewSkillChoices,
  nextNewPowerChoices,
  nextProficiencyBonus,
  availableLevelUpSkills,
  availableLevelUpPowers,
  onOpenLevelUpWizard,
  onToggleLevelUpSkill,
  onToggleLevelUpPower,
  onCloseLevelUpWizard,
  onApplyLevelUp,
  onNameChange,
  onAttributeChange,
  onSpeedChange,
  onAcBaseChange,
  onAcBonusChange,
  onAcUseDexChange,
  onInitMiscChange,
  onSaveProfChange,
  onSaveBonusChange,
  onSkillChange,
  onTogglePower,
  onPowerChange,
  onToggleItem,
  onQuantityChange,
  onEquippedChange,
  onRemoveManualItem,
  onAddManualItem,
  onAddAttack,
  onAttackChange,
}: SelectedCharacterWorkspaceProps) {
  if (levelUpOpen) {
    return (
      <div style={{ flex: 1 }}>
        <LevelUpWizard
          character={character}
          className={selectedClassName}
          labels={labels}
          nextLevel={nextLevel}
          hitDiceGained={nextHitDiceGained}
          attributeBonuses={nextAttributeBonuses}
          newSkillChoices={nextNewSkillChoices}
          newPowerChoices={nextNewPowerChoices}
          proficiencyBonusOverride={nextProficiencyBonus}
          availableSkillChoices={availableLevelUpSkills}
          availablePowerChoices={availableLevelUpPowers}
          selectedSkillIds={levelUpSkillSelections}
          selectedPowerIds={levelUpPowerSelections}
          missingProgressionMessage={levelUpMissingRowMessage}
          onToggleSkill={onToggleLevelUpSkill}
          onTogglePower={onToggleLevelUpPower}
          onCancel={onCloseLevelUpWizard}
          onApply={onApplyLevelUp}
          applyPending={levelUpApplyPending}
        />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "grid", gap: 24 }}>
      <IdentitySection
        character={character}
        campaignName={selectedCampaignName}
        raceName={selectedRaceName}
        classLabel={labels.className}
        className={selectedClassName}
        levelLabel={labels.level}
        hpLabel={labels.hp}
        onNameChange={onNameChange}
        onOpenLevelUpWizard={onOpenLevelUpWizard}
      />

      <AttributesSection
        character={character}
        label={labels.attributes}
        onChange={onAttributeChange}
      />

      <SheetFieldsSection
        character={character}
        onSpeedChange={onSpeedChange}
        onAcBaseChange={onAcBaseChange}
        onAcBonusChange={onAcBonusChange}
        onAcUseDexChange={onAcUseDexChange}
        onInitMiscChange={onInitMiscChange}
        onSaveProfChange={onSaveProfChange}
        onSaveBonusChange={onSaveBonusChange}
      />

      <SkillsSection
        character={character}
        skills={selectedSkills}
        label={labels.skills}
        onChange={onSkillChange}
      />

      <PowersSection
        character={character}
        powers={selectedPowers}
        label={labels.powers}
        onTogglePower={onTogglePower}
        onPowerChange={onPowerChange}
      />

      <InventorySection
        character={character}
        items={selectedItems}
        label={labels.inventory}
        onToggleItem={onToggleItem}
        onQuantityChange={onQuantityChange}
        onEquippedChange={onEquippedChange}
        onRemoveManualItem={onRemoveManualItem}
        onAddManualItem={onAddManualItem}
      />

      <AttacksSection
        character={character}
        label={labels.attacks}
        onAdd={onAddAttack}
        onChange={onAttackChange}
      />

      <Roll20ExportPanel
        characterName={character.identity.name}
        combinedCommand={chatSetAttrCommand}
        phase1Command={roll20Phase1Command}
        phase2Command={roll20Phase2Command}
      />
    </div>
  );
}
