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
import { buttonStyle, cardStyle, panelStyle, primaryButtonStyle } from "./uiStyles";

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
  canUseGmQuickActions: boolean;
  onDuplicateCharacter: () => void;
  onDeleteCharacter: () => void;
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
  canUseGmQuickActions,
  onDuplicateCharacter,
  onDeleteCharacter,
}: SelectedCharacterWorkspaceProps) {
  const [showAllAttacks, setShowAllAttacks] = useState(false);
  const [nameEditRequestToken, setNameEditRequestToken] = useState(0);
  const [addPlayerRequestToken, setAddPlayerRequestToken] = useState(0);
  const [abilitiesExpandedSeed, setAbilitiesExpandedSeed] = useState(0);

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
    <div style={{ flex: 1, display: "grid", gap: 16 }} className="selected-workspace mobile-stack character-dashboard">
      <div
        className="character-quick-actions"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          ...panelStyle,
          padding: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          className="button-control"
          style={primaryButtonStyle}
          disabled={readOnly}
          onClick={() => setNameEditRequestToken((value) => value + 1)}
        >
          Edit
        </button>
        <button
          className="button-control"
          style={buttonStyle}
          disabled={!canUseGmQuickActions}
          onClick={onDuplicateCharacter}
        >
          Duplicate
        </button>
        <button
          className="button-control"
          style={buttonStyle}
          disabled={!canUseGmQuickActions || !canManageCharacterAccess}
          onClick={() => setAddPlayerRequestToken((value) => value + 1)}
        >
          Assign Player
        </button>
        <button
          className="button-control"
          style={buttonStyle}
          disabled={readOnly}
          onClick={() => setAbilitiesExpandedSeed((value) => value + 1)}
        >
          Add Power
        </button>
        <button
          className="button-control"
          style={{ ...buttonStyle, borderColor: "var(--cb-button-danger-border)", color: "var(--cb-button-danger-text)" }}
          disabled={!canUseGmQuickActions}
          onClick={onDeleteCharacter}
        >
          Delete
        </button>
      </div>

      <div className="character-dashboard-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)", gap: 16 }}>
        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section style={{ ...panelStyle, padding: 16 }}>
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
              canEditCharacterType={canEditCharacterType}
              editNameRequestToken={nameEditRequestToken}
              onNameChange={onNameChange}
              onCharacterTypeChange={onCharacterTypeChange}
              onOpenLevelUpWizard={onOpenLevelUpWizard}
            />
          </section>

          <section style={{ ...panelStyle, padding: 16, display: "grid", gap: 12 }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: 18 }}>Access</h3>
            {canManageCharacterAccess ? (
              <CharacterAccessPanel
                characterName={character.identity.name?.trim() || "this character"}
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {accessNames.length > 0
                    ? accessNames.map((name) => (
                        <span
                          key={name}
                          style={{
                            minHeight: 36,
                            borderRadius: 999,
                            padding: "0 12px",
                            display: "inline-flex",
                            alignItems: "center",
                            border: "1px solid var(--cb-border)",
                            background: "var(--cb-selection-row-bg)",
                            color: "var(--text-primary)",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          {name}
                        </span>
                      ))
                    : (
                      <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>No players assigned.</div>
                    )}
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                  You can view assigned players, but only a GM/Admin can modify access.
                </div>
              </div>
            )}
          </section>

          <section style={{ ...panelStyle, padding: 16, display: "grid", gap: 16 }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: 18 }}>Combat</h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
              <div style={{ ...cardStyle, display: "grid", gap: 4, background: "var(--cb-accent-soft)", borderColor: "var(--cb-border-strong)" }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>HP</span>
                <strong style={{ color: "var(--text-primary)", fontSize: 18 }}>{hpValue}</strong>
              </div>
              <div style={{ ...cardStyle, display: "grid", gap: 4 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>AC</span>
                <strong style={{ color: "var(--text-primary)", fontSize: 18 }}>{acValue}</strong>
              </div>
              <div style={{ ...cardStyle, display: "grid", gap: 4 }}>
                <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>INIT</span>
                <strong style={{ color: "var(--text-primary)", fontSize: 18 }}>{initiativeValue >= 0 ? `+${initiativeValue}` : initiativeValue}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>Top attacks</div>
              {topAttacks.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {topAttacks.map((attack) => (
                    <div key={attack.id} style={{ ...cardStyle, display: "grid", gap: 4 }}>
                      <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{attack.name}</strong>
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        {attack.damage} • Bonus {attack.bonus >= 0 ? `+${attack.bonus}` : attack.bonus}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>No attacks added yet.</div>
              )}
              <button
                type="button"
                className="button-control button-control--secondary"
                style={buttonStyle}
                onClick={() => setShowAllAttacks((value) => !value)}
                disabled={readOnly && character.attacks.length === 0}
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
        </div>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <CollapsibleSection
            key={`abilities-section-${abilitiesExpandedSeed}`}
            id="abilities-section"
            title="Abilities"
            summary={`${labels.skills}, ${labels.powers}`}
            defaultExpanded={abilitiesExpandedSeed > 0}
          >
            <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: "grid", gap: 16 }}>
              <SkillsSection
                character={character}
                skills={selectedSkills}
                label={labels.skills}
                onChange={onSkillChange}
              />
              {selectedPowers.length === 0 ? (
                <div style={{ ...cardStyle, color: "var(--text-secondary)", fontSize: 13 }}>No powers added yet.</div>
              ) : null}
              <PowersSection
                character={character}
                powers={selectedPowers}
                label={labels.powers}
                onTogglePower={onTogglePower}
                onPowerChange={onPowerChange}
              />
            </fieldset>
          </CollapsibleSection>

          <CollapsibleSection id="details-section" title="Details" summary={`${labels.inventory}, notes, misc`}>
            <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: "grid", gap: 16 }}>
              <AttributesSection
                character={character}
                label={labels.attributes}
                onChange={onAttributeChange}
              />
              <InventorySection
                character={character}
                items={selectedItems}
                label={labels.inventory}
                onToggleItem={onToggleItem}
                onQuantityChange={onQuantityChange}
                onRemoveManualItem={onRemoveManualItem}
                onAddManualItem={onAddManualItem}
              />
              <section style={{ ...cardStyle, display: "grid", gap: 8 }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>Notes</div>
                <div style={{ color: "var(--text-primary)", fontSize: 14 }}>
                  {character.identity.notes?.trim() || "No notes added yet."}
                </div>
              </section>
            </fieldset>
          </CollapsibleSection>

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
        </div>
      </div>
    </div>
  );
}
