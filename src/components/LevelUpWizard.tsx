import type { CharacterRecord } from "../types/character";
import type {
  AttributeBonusRule,
  CampaignLabels,
  PowerDefinition,
  SkillDefinition,
} from "../types/gameData";
import {
  buttonStyle,
  panelStyle,
  sectionTitleStyle,
} from "./uiStyles";

interface Props {
  character: CharacterRecord;
  className: string;
  labels: CampaignLabels;
  nextLevel: number;
  hitDiceGained: number;
  attributeBonuses: AttributeBonusRule[];
  newSkillChoices: number;
  newPowerChoices: number;
  proficiencyBonusOverride?: number;
  availableSkillChoices: SkillDefinition[];
  availablePowerChoices: PowerDefinition[];
  selectedSkillIds: string[];
  selectedPowerIds: string[];
  missingProgressionMessage?: string | null;
  onToggleSkill: (skillId: string, nextSelected: boolean) => void;
  onTogglePower: (powerId: string, nextSelected: boolean) => void;
  onCancel: () => void;
  onApply: () => void;
  applyPending?: boolean;
}

function formatAttributeBonuses(bonuses: AttributeBonusRule[]) {
  if (bonuses.length === 0) return "None";
  return bonuses
    .map((bonus) => `${bonus.attribute} ${bonus.amount >= 0 ? `+${bonus.amount}` : bonus.amount}`)
    .join(", ");
}

export default function LevelUpWizard({
  character,
  className,
  labels,
  nextLevel,
  hitDiceGained,
  attributeBonuses,
  newSkillChoices,
  newPowerChoices,
  proficiencyBonusOverride,
  availableSkillChoices,
  availablePowerChoices,
  selectedSkillIds,
  selectedPowerIds,
  missingProgressionMessage,
  onToggleSkill,
  onTogglePower,
  onCancel,
  onApply,
  applyPending,
}: Props) {
  const skillsComplete = selectedSkillIds.length === newSkillChoices;
  const powersComplete = selectedPowerIds.length === newPowerChoices;
  const skillsRemaining = Math.max(0, newSkillChoices - selectedSkillIds.length);
  const powersRemaining = Math.max(0, newPowerChoices - selectedPowerIds.length);
  const skillChoicesBlocked = newSkillChoices > availableSkillChoices.length;
  const powerChoicesBlocked = newPowerChoices > availablePowerChoices.length;
  const canApply =
    !missingProgressionMessage &&
    !skillChoicesBlocked &&
    !powerChoicesBlocked &&
    !applyPending &&
    skillsComplete &&
    powersComplete;

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={sectionTitleStyle}>Level Up Wizard</h2>
        <button onClick={onCancel} className="button-control" style={buttonStyle}>
          Cancel
        </button>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "rgba(10, 20, 39, 0.78)",
            border: "1px solid var(--border-soft)",
            color: "var(--text-primary)",
          }}
        >
          <div>
            <strong>{character.identity.name}</strong> ({className})
          </div>
          <div style={{ marginTop: 4, color: "var(--text-secondary)" }}>
            Current {labels.level}: {character.level}{" -> "}New {labels.level}: {nextLevel}
          </div>
        </div>

        {missingProgressionMessage ? (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "rgba(255, 122, 157, 0.18)",
              border: "1px solid var(--cb-danger-soft-border)",
              color: "var(--cb-danger-text)",
            }}
          >
            {missingProgressionMessage}
          </div>
        ) : (
          <>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "var(--cb-accent-soft-strong)",
                border: "1px solid var(--accent-primary)",
                color: "var(--text-primary)",
              }}
            >
              <strong>Automatic Effects</strong>
              <div style={{ marginTop: 6 }}>Level: +1</div>
              <div>Hit Dice: +{hitDiceGained}</div>
              {Number.isFinite(proficiencyBonusOverride) && (
                <div>Proficiency Bonus: set to {proficiencyBonusOverride}</div>
              )}
              <div>Attribute Increases: {formatAttributeBonuses(attributeBonuses)}</div>
            </div>

            {skillChoicesBlocked && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(255, 122, 157, 0.18)",
                  border: "1px solid var(--cb-danger-soft-border)",
                  color: "var(--cb-danger-text)",
                }}
              >
                This level requires {newSkillChoices} new {labels.skills.toLowerCase()} choices, but only {availableSkillChoices.length} are available.
              </div>
            )}

            {powerChoicesBlocked && (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "rgba(255, 122, 157, 0.18)",
                  border: "1px solid var(--cb-danger-soft-border)",
                  color: "var(--cb-danger-text)",
                }}
              >
                This level requires {newPowerChoices} new {labels.powers.toLowerCase()} choices, but only {availablePowerChoices.length} are available.
              </div>
            )}

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                {labels.skills} Choices ({selectedSkillIds.length}/{newSkillChoices})
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                Remaining: {skillsRemaining}
              </div>
              {newSkillChoices === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>No new skill choices this level.</div>
              ) : availableSkillChoices.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  No available skills remain for selection.
                </div>
              ) : (
                availableSkillChoices.map((skill) => {
                  const selected = selectedSkillIds.includes(skill.id);
                  const disabled = !selected && selectedSkillIds.length >= newSkillChoices;

                  return (
                    <label
                      key={skill.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid var(--border-soft)",
                        background: selected
                          ? "var(--cb-accent-soft-strong)"
                          : "var(--cb-selection-row-bg)",
                        color: "var(--text-primary)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span>
                        <strong>{skill.name}</strong> ({skill.attribute})
                        {skill.description && (
                          <div
                            style={{
                              fontWeight: 400,
                              fontSize: 14,
                              color: "var(--text-secondary)",
                              marginTop: 4,
                            }}
                          >
                            {skill.description}
                          </div>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={(e) => onToggleSkill(skill.id, e.target.checked)}
                      />
                    </label>
                  );
                })
              )}
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                {labels.powers} Choices ({selectedPowerIds.length}/{newPowerChoices})
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                Remaining: {powersRemaining}
              </div>
              {newPowerChoices === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>No new power choices this level.</div>
              ) : availablePowerChoices.length === 0 ? (
                <div style={{ color: "var(--text-secondary)" }}>
                  No available powers remain for selection.
                </div>
              ) : (
                availablePowerChoices.map((power) => {
                  const selected = selectedPowerIds.includes(power.id);
                  const disabled = !selected && selectedPowerIds.length >= newPowerChoices;

                  return (
                    <label
                      key={power.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid var(--border-soft)",
                        background: selected
                          ? "var(--cb-accent-soft-strong)"
                          : "var(--cb-selection-row-bg)",
                        color: "var(--text-primary)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <span>
                        <strong>{power.name}</strong>
                        <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>
                          Level {power.level ?? 1}
                        </span>
                        <div
                          style={{
                            fontWeight: 400,
                            fontSize: 14,
                            color: "var(--text-secondary)",
                            marginTop: 4,
                          }}
                        >
                          {power.description || "No description."}
                        </div>
                      </span>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={disabled}
                        onChange={(e) => onTogglePower(power.id, e.target.checked)}
                      />
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 24,
        }}
      >
        <button onClick={onCancel} className="button-control" style={buttonStyle}>
          Back
        </button>
        <button onClick={onApply} disabled={!canApply} className="button-control" style={buttonStyle}>
          {applyPending ? "Applying..." : "Apply Level Up"}
        </button>
      </div>
    </section>
  );
}
