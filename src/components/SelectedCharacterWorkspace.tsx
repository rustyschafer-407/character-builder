import { useState, type ReactNode } from "react";
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
import CharacterAccessPanel from "./CharacterAccessPanel";
import type {
  CampaignAccessRow,
  CharacterAccessRole,
  CharacterAccessRow,
  ProfileRow,
} from "../lib/cloudRepository";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  summary?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

function CollapsibleSection({
  id,
  title,
  summary,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <section
      style={{
        border: "1px solid var(--cb-border)",
        borderRadius: 12,
        background: "var(--cb-surface-raised)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={id}
        onClick={() => setIsExpanded((previous) => !previous)}
        className="button-control"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          border: "none",
          borderBottom: isExpanded ? "1px solid var(--cb-border)" : "none",
          borderRadius: 0,
          background: "transparent",
          color: "var(--cb-text)",
          padding: "12px 14px",
          minHeight: 48,
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <span style={{ display: "grid", gap: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          {summary ? (
            <span style={{ fontSize: 12, color: "var(--cb-text-muted)" }}>{summary}</span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cb-text-muted)",
            minWidth: 10,
            textAlign: "center",
          }}
        >
          {isExpanded ? "v" : ">"}
        </span>
      </button>

      {isExpanded ? (
        <div id={id} style={{ padding: "var(--space-3)" }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

interface SelectedCharacterWorkspaceProps {
  character: CharacterRecord;
  readOnly?: boolean;
  selectedCampaignName: string;
  selectedRaceName: string;
  selectedClassName: string;
  labels: CampaignLabels;
  selectedSkills: SkillDefinition[];
  selectedPowers: PowerDefinition[];
  selectedItems: ItemDefinition[];
  roll20ModPayload: string;
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
  onCharacterTypeChange: (characterType: "pc" | "npc") => void;
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
  onRemoveManualItem: (itemName: string) => void;
  onAddManualItem: () => void;
  onAddAttack: () => void;
  onAttackChange: (id: string, field: "name" | "damage" | "bonus", value: string | number) => void;
  canManageCharacterAccess: boolean;
  characterAccessUsers: ProfileRow[];
  campaignAccessRows: CampaignAccessRow[];
  characterAccessRows: CharacterAccessRow[];
  characterUserCandidateIds: string[];
  getUserLabel: (userId: string) => string;
  onAssignCharacterAccess: (input: { userId: string; role: CharacterAccessRole }) => Promise<void>;
  onUpdateCharacterAccess: (input: { userId: string; role: CharacterAccessRole }) => Promise<void>;
  onRemoveCharacterAccess: (userId: string) => Promise<void>;
  characterAccessErrorMessage: string;
  onClearCharacterAccessError: () => void;
}

export default function SelectedCharacterWorkspace({
  character,
  readOnly = false,
  selectedCampaignName,
  selectedRaceName,
  selectedClassName,
  labels,
  selectedSkills,
  selectedPowers,
  selectedItems,
  roll20ModPayload,
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
  onCharacterTypeChange,
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
  onRemoveManualItem,
  onAddManualItem,
  onAddAttack,
  onAttackChange,
  canManageCharacterAccess,
  characterAccessUsers,
  campaignAccessRows,
  characterAccessRows,
  characterUserCandidateIds,
  getUserLabel,
  onAssignCharacterAccess,
  onUpdateCharacterAccess,
  onRemoveCharacterAccess,
  characterAccessErrorMessage,
  onClearCharacterAccessError,
}: SelectedCharacterWorkspaceProps) {
  const summarizeValues = (values: string[], maxVisible = 4) => {
    const cleaned = values
      .map((value) => value.trim())
      .filter((value, index, collection) => Boolean(value) && collection.indexOf(value) === index);

    if (cleaned.length === 0) {
      return "None";
    }

    if (cleaned.length <= maxVisible) {
      return cleaned.join(", ");
    }

    return `${cleaned.slice(0, maxVisible).join(", ")}, ...`;
  };

  const attributeSummary = (["STR", "DEX", "CON", "INT", "WIS", "CHA"] as AttributeKey[])
    .map((key) => `${key} ${character.attributes[key]}`)
    .join(", ");

  const skillsSummary = summarizeValues(
    character.skills
      .filter((skill) => skill.proficient || skill.bonus !== 0)
      .map((skill) => selectedSkills.find((candidate) => candidate.id === skill.skillId)?.name || skill.skillId)
  );

  const powersSummary = summarizeValues(
    character.powers.map((power) => {
      const directName = power.name?.trim();
      if (directName) {
        return directName;
      }

      if (power.powerId) {
        return selectedPowers.find((candidate) => candidate.id === power.powerId)?.name || power.powerId;
      }

      return "";
    })
  );

  const inventorySummary = summarizeValues(
    character.inventory.map((item) => {
      const name = item.name?.trim();
      if (!name) {
        return "";
      }

      return item.quantity > 1 ? `${name} x${item.quantity}` : name;
    })
  );

  const attacksSummary = summarizeValues(
    character.attacks.map((attack) => attack.name?.trim() || attack.id)
  );

  const accessSummary = summarizeValues(
    Array.from(
      new Set([
        ...characterAccessRows.map((row) => row.user_id),
        ...campaignAccessRows.map((row) => row.user_id),
      ])
    ).map((userId) => getUserLabel(userId)),
    5
  );
  const coreSummary = `AC ${character.sheet.acBase + character.sheet.acBonus}, Init ${
    character.sheet.initMisc
  }, Speed ${character.sheet.speed || "-"}`;

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
        roll20ModPayload={roll20ModPayload}
        readOnly={readOnly}
        onNameChange={onNameChange}
        onCharacterTypeChange={onCharacterTypeChange}
        onOpenLevelUpWizard={onOpenLevelUpWizard}
      />

      {canManageCharacterAccess ? (
        <CollapsibleSection
          id="character-access-section"
          title="Accounts & Permissions"
          summary={accessSummary}
        >
          <CharacterAccessPanel
            characterName={character.identity.name?.trim() || "this character"}
            users={characterAccessUsers}
            campaignAccessRows={campaignAccessRows}
            characterAccessRows={characterAccessRows}
            characterUserCandidateIds={characterUserCandidateIds}
            getUserLabel={getUserLabel}
            onAssignCharacterAccess={onAssignCharacterAccess}
            onUpdateCharacterAccess={onUpdateCharacterAccess}
            onRemoveCharacterAccess={onRemoveCharacterAccess}
            errorMessage={characterAccessErrorMessage}
            onClearError={onClearCharacterAccessError}
          />
        </CollapsibleSection>
      ) : null}

      {readOnly ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--border-soft)",
            background: "rgba(11, 22, 42, 0.65)",
            color: "var(--text-secondary)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Read-only access: you can view this character, but editing is disabled.
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 16,
          minWidth: 0,
        }}
      >
        <CollapsibleSection
          id="attributes-section"
          title={labels.attributes}
          summary={attributeSummary}
        >
          <fieldset
            disabled={readOnly}
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
            <AttributesSection
              character={character}
              label={labels.attributes}
              onChange={onAttributeChange}
            />
          </fieldset>
        </CollapsibleSection>

        <CollapsibleSection id="core-section" title="Core" summary={coreSummary}>
          <fieldset
            disabled={readOnly}
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
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
          </fieldset>
        </CollapsibleSection>

        <CollapsibleSection
          id="skills-section"
          title={labels.skills}
          summary={skillsSummary}
        >
          <fieldset
            disabled={readOnly}
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
            <SkillsSection
              character={character}
              skills={selectedSkills}
              label={labels.skills}
              onChange={onSkillChange}
            />
          </fieldset>
        </CollapsibleSection>

        <CollapsibleSection
          id="powers-section"
          title={labels.powers}
          summary={powersSummary}
        >
          <fieldset
            disabled={readOnly}
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
            <PowersSection
              character={character}
              powers={selectedPowers}
              label={labels.powers}
              onTogglePower={onTogglePower}
              onPowerChange={onPowerChange}
            />
          </fieldset>
        </CollapsibleSection>

        <CollapsibleSection
          id="inventory-section"
          title={labels.inventory}
          summary={inventorySummary}
        >
          <fieldset
            disabled={readOnly}
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
            <InventorySection
              character={character}
              items={selectedItems}
              label={labels.inventory}
              onToggleItem={onToggleItem}
              onQuantityChange={onQuantityChange}
              onRemoveManualItem={onRemoveManualItem}
              onAddManualItem={onAddManualItem}
            />
          </fieldset>
        </CollapsibleSection>

        <CollapsibleSection
          id="attacks-section"
          title={labels.attacks}
          summary={attacksSummary}
        >
          <fieldset
            disabled={readOnly}
            style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
            <AttacksSection
              character={character}
              label={labels.attacks}
              onAdd={onAddAttack}
              onChange={onAttackChange}
            />
          </fieldset>
        </CollapsibleSection>
      </div>
    </div>
  );
}
