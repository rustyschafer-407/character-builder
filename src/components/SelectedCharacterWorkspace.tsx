import { useMemo, useState, type ReactNode } from "react";
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
  CampaignAccessRowWithProfile,
  CharacterAccessRole,
  CharacterAccessRowWithProfile,
} from "../lib/cloudRepository";
import { getAccessRowDisplayName } from "../lib/userDisplay";
import { buttonStyle, cardStyle, panelStyle } from "./uiStyles";

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
    <section className="workspace-collapsible-card" style={{ ...panelStyle, padding: 0, borderRadius: 12 }}>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={id}
        onClick={() => setIsExpanded((previous) => !previous)}
        className="button-control workspace-collapsible-trigger"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          border: "none",
          borderBottom: isExpanded ? "1px solid var(--cb-border)" : "none",
          borderRadius: 12,
          background: "transparent",
          color: "var(--cb-text)",
          padding: "12px 16px",
          minHeight: 40,
          textAlign: "left",
          cursor: "pointer",
          boxShadow: "none",
        }}
      >
        <span style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--cb-text)" }}>{title}</span>
          {summary ? (
            <span style={{ fontSize: 12, color: "var(--cb-text-muted)", opacity: 0.84 }}>{summary}</span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "var(--cb-text-muted)",
            minWidth: 12,
            textAlign: "center",
          }}
        >
          {isExpanded ? "▾" : "▸"}
        </span>
      </button>

      {isExpanded ? (
        <div id={id} style={{ padding: "16px" }}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

interface SelectedCharacterWorkspaceProps {
  character: CharacterRecord;
  readOnly?: boolean;
  canEditCharacterType?: boolean;
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
  campaignAccessRows: CampaignAccessRowWithProfile[];
  characterAccessRows: CharacterAccessRowWithProfile[];
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
  canEditCharacterType = false,
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
  const [showAllAttacks, setShowAllAttacks] = useState(false);
  const nameEditRequestToken = 0;
  const addPlayerRequestToken = 0;

  const accessNames = useMemo(() => {
    const labels = [
      ...characterAccessRows.map((row) => getAccessRowDisplayName(row.profile)),
      ...campaignAccessRows.map((row) => getAccessRowDisplayName(row.profile)),
    ];
    return Array.from(new Set(labels));
  }, [characterAccessRows, campaignAccessRows]);

  const topAttacks = useMemo(
    () => [...character.attacks].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).slice(0, 2),
    [character.attacks]
  );

  const hpValue = `${character.hp.current}/${character.hp.max}`;
  const acValue = character.sheet.acBase + character.sheet.acBonus + (character.sheet.acUseDex ? Math.floor((character.attributes.DEX - 10) / 2) : 0);
  const initiativeValue = Math.floor((character.attributes.DEX - 10) / 2) + character.sheet.initMisc;

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
    <div style={{ flex: 1 }} className="selected-workspace character-detail">
      <div className="character-section-stack" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <IdentitySection
          character={character}
          campaignName={selectedCampaignName}
          raceName={selectedRaceName}
          className={selectedClassName}
          levelLabel={labels.level}
          hpLabel={labels.hp}
          roll20ModPayload={roll20ModPayload}
          readOnly={readOnly}
          canEditCharacterType={canEditCharacterType}
          editNameRequestToken={nameEditRequestToken}
          onNameChange={onNameChange}
          onCharacterTypeChange={onCharacterTypeChange}
          onOpenLevelUpWizard={onOpenLevelUpWizard}
        />

        <section className="access-card" style={{ ...panelStyle, padding: 20, display: "grid", gap: 16 }}>
          <div>
            <div className="section-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <h3 className="section-title" style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 700 }}>
                Access
              </h3>
            </div>
            <div className="section-description" style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Who can view or edit this character.
            </div>
          </div>

          {canManageCharacterAccess ? (
            <CharacterAccessPanel
              campaignAccessRows={campaignAccessRows}
              characterAccessRows={characterAccessRows}
              characterUserCandidateIds={characterUserCandidateIds}
              getUserLabel={getUserLabel}
              onAssignCharacterAccess={onAssignCharacterAccess}
              onUpdateCharacterAccess={onUpdateCharacterAccess}
              onRemoveCharacterAccess={onRemoveCharacterAccess}
              errorMessage={characterAccessErrorMessage}
              onClearError={onClearCharacterAccessError}
              openAddPlayerRequestToken={addPlayerRequestToken}
            />
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="access-chip-row" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {accessNames.length > 0 ? (
                  accessNames.map((name) => (
                    <span
                      key={name}
                      className="access-chip"
                      style={{
                        minHeight: 36,
                        padding: "0 14px",
                        borderRadius: 999,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        border: "1px solid var(--cb-border)",
                        background: "var(--cb-selection-row-bg)",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {name}
                    </span>
                  ))
                ) : (
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>No players assigned.</div>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="combat-card" style={{ ...panelStyle, padding: 20, display: "grid", gap: 16 }}>
          <div className="combat-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <h3 className="combat-title" style={{ margin: 0, color: "var(--text-primary)", fontSize: "1.15rem", fontWeight: 700 }}>
              Combat
            </h3>
          </div>

          <div className="combat-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            <div className="combat-stat combat-stat--hp" style={{ ...cardStyle, minHeight: 88, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center", background: "var(--cb-accent-soft)", borderColor: "var(--cb-border-strong)" }}>
              <span className="combat-stat-label" style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>HP</span>
              <strong className="combat-stat-value" style={{ marginTop: 6, fontSize: "1.5rem", lineHeight: 1, fontWeight: 800, color: "var(--text-primary)" }}>{hpValue}</strong>
            </div>
            <div className="combat-stat" style={{ ...cardStyle, minHeight: 88, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <span className="combat-stat-label" style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>AC</span>
              <strong className="combat-stat-value" style={{ marginTop: 6, fontSize: "1.5rem", lineHeight: 1, fontWeight: 800, color: "var(--text-primary)" }}>{acValue}</strong>
            </div>
            <div className="combat-stat" style={{ ...cardStyle, minHeight: 88, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <span className="combat-stat-label" style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)" }}>INIT</span>
              <strong className="combat-stat-value" style={{ marginTop: 6, fontSize: "1.5rem", lineHeight: 1, fontWeight: 800, color: "var(--text-primary)" }}>{initiativeValue >= 0 ? `+${initiativeValue}` : initiativeValue}</strong>
            </div>
          </div>

          <div className="top-attacks" style={{ display: "grid", gap: 8 }}>
            <div className="subsection-label" style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>Top attacks</div>
            {topAttacks.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {topAttacks.map((attack) => (
                  <div key={attack.id} className="attack-preview-row" style={{ borderRadius: 10, padding: "12px 14px", border: "1px solid var(--cb-border)", background: "var(--cb-surface-raised)" }}>
                    <div className="attack-name" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{attack.name}</div>
                    <div className="attack-meta" style={{ marginTop: 4, fontSize: "0.9rem", color: "var(--text-secondary)" }}>
                      {attack.damage} · Bonus {attack.bonus >= 0 ? `+${attack.bonus}` : attack.bonus}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>No attacks added yet.</div>
            )}

            <button
              type="button"
              className="button-control show-full-attacks-button"
              style={{ ...buttonStyle, width: "100%", marginTop: 12 }}
              onClick={() => setShowAllAttacks((value) => !value)}
            >
              {showAllAttacks ? "Hide full attacks" : "Show full attacks"}
            </button>
          </div>

          {showAllAttacks ? (
            <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
              <AttacksSection
                character={character}
                label={labels.attacks}
                onAdd={onAddAttack}
                onChange={onAttackChange}
              />
            </fieldset>
          ) : null}

          <CollapsibleSection id="combat-details" title="Combat details" summary="Speed, AC formula, saves">
            <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
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
        </section>

        {readOnly ? (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 12,
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

        <CollapsibleSection id="attributes-section" title={labels.attributes} summary="Ability scores and modifiers">
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <AttributesSection
              character={character}
              label={labels.attributes}
              onChange={onAttributeChange}
            />
          </fieldset>
        </CollapsibleSection>

        <CollapsibleSection id="skills-section" title={labels.skills} summary="Proficiencies and bonuses">
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <SkillsSection
              character={character}
              skills={selectedSkills}
              label={labels.skills}
              onChange={onSkillChange}
            />
          </fieldset>
        </CollapsibleSection>

        <CollapsibleSection id="powers-section" title={labels.powers} summary="Selected powers">
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
            <PowersSection
              character={character}
              powers={selectedPowers}
              label={labels.powers}
              onTogglePower={onTogglePower}
              onPowerChange={onPowerChange}
            />
          </fieldset>
        </CollapsibleSection>

        <CollapsibleSection id="inventory-section" title={labels.inventory} summary="Items and quantities">
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
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
      </div>
    </div>
  );
}
