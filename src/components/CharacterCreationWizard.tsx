import type {
  CharacterAttack,
  CharacterAttributeGeneration,
  CharacterHp,
  CharacterIdentity,
  CharacterItem,
  CharacterLevelProgressionState,
  CharacterPowerSelection,
  CharacterSkillSelection,
} from "../types/character";
import type {
  AttributeKey,
  ClassDefinition,
  ClassItemChoiceRule,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  CampaignDefinition,
  CampaignLabels,
  ItemDefinition,
  PowerDefinition,
  RaceDefinition,
  SkillDefinition,
} from "../types/gameData";
import {
  getItemChoiceState,
  getPowerChoiceState,
  getSelectedCountForItemRule,
  getSelectedCountForPowerRule,
  getSelectedCountForSkillRule,
  getSkillChoiceState,
} from "../lib/creationChoiceRules";
import { getAttributeModifier } from "../lib/character";
import { getAttributeBonusTotals, getPointBuyBaseScore, getPointBuyCost } from "../lib/pointBuy";
import { buttonStyle, inputStyle, panelStyle, sectionTitleStyle, selectStyle, statCardStyle } from "./uiStyles";

export interface CharacterCreationDraft {
  identity: CharacterIdentity;
  campaignId: string;
  raceId: string;
  classId: string;
  level: number;
  proficiencyBonus: number;
  attributes: Record<AttributeKey, number>;
  saveProf: Record<AttributeKey, boolean>;
  attributeGeneration?: CharacterAttributeGeneration;
  hp: CharacterHp;
  skills: CharacterSkillSelection[];
  powers: CharacterPowerSelection[];
  inventory: CharacterItem[];
  attacks: CharacterAttack[];
  levelProgression: CharacterLevelProgressionState;
}

interface Props {
  step: number;
  draft: CharacterCreationDraft;
  campaigns: CampaignDefinition[];
  racesForCampaign: RaceDefinition[];
  classesForCampaign: ClassDefinition[];
  selectedCampaign: CampaignDefinition | null;
  selectedRace: RaceDefinition | null;
  selectedClass: ClassDefinition | null;
  skills: SkillDefinition[];
  powers: PowerDefinition[];
  items: ItemDefinition[];
  skillChoiceRules: ClassSkillChoiceRule[];
  powerChoiceRules: ClassPowerChoiceRule[];
  itemChoiceRules: ClassItemChoiceRule[];
  pointBuyTotal: number;
  pointBuyRemaining: number;
  labels: CampaignLabels;
  onNameChange: (name: string) => void;
  onCampaignChange: (campaignId: string) => void;
  onRaceChange: (raceId: string) => void;
  onClassChange: (classId: string) => void;
  onAttributeGenerationChange: (method: "pointBuy" | "randomRoll" | "manual") => void;
  onAttributeChange: (key: AttributeKey, value: number) => void;
  onSaveProfToggle: (attribute: AttributeKey, nextSelected: boolean) => void;
  onRollAttributes: () => void;
  onSkillToggle: (skillId: string, nextSelected: boolean) => void;
  onPowerToggle: (powerId: string, nextSelected: boolean) => void;
  onItemToggle: (itemId: string, nextSelected: boolean) => void;
  onBack: () => void;
  onNext: () => void;
  onCancel: () => void;
  onFinish: () => void;
}

const ATTRS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

function getStepTitles(labels: CampaignLabels) {
  return [
    "Campaign",
    "Race",
    labels.className,
    labels.attributes,
    "Saves",
    labels.skills,
    labels.powers,
    labels.inventory,
    "Review",
  ];
}

function getStepStatus(index: number, currentStep: number) {
  if (index < currentStep) return "done";
  if (index === currentStep) return "current";
  return "upcoming";
}

function formatSignedNumber(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatClassAttributeModifiers(
  selectedClass: ClassDefinition | null
) {
  if (!selectedClass) return "";
  const modifiers = (selectedClass.attributeBonuses ?? []).filter((bonus) => bonus.amount !== 0);
  if (modifiers.length === 0) return "None";
  return modifiers
    .map((bonus) => `${bonus.attribute} ${formatSignedNumber(bonus.amount)}`)
    .join(", ");
}

function formatRaceAttributeModifiers(selectedRace: RaceDefinition | null) {
  if (!selectedRace) return "";
  const modifiers = (selectedRace.attributeBonuses ?? []).filter((bonus) => bonus.amount !== 0);
  if (modifiers.length === 0) return "None";
  return modifiers
    .map((bonus) => `${bonus.attribute} ${formatSignedNumber(bonus.amount)}`)
    .join(", ");
}

export default function CharacterCreationWizard({
  step,
  draft,
  campaigns,
  racesForCampaign,
  classesForCampaign,
  selectedCampaign,
  selectedRace,
  selectedClass,
  skills,
  powers,
  items,
  skillChoiceRules,
  powerChoiceRules,
  itemChoiceRules,
  pointBuyTotal,
  pointBuyRemaining,
  labels,
  onNameChange,
  onCampaignChange,
  onRaceChange,
  onClassChange,
  onAttributeGenerationChange,
  onAttributeChange,
  onSaveProfToggle,
  onRollAttributes,
  onSkillToggle,
  onPowerToggle,
  onItemToggle,
  onBack,
  onNext,
  onCancel,
  onFinish,
}: Props) {
  const method = draft.attributeGeneration?.method ?? selectedCampaign?.attributeRules.generationMethods[0] ?? "pointBuy";
  const stepTitles = getStepTitles(labels);
  const classModifiersText = formatClassAttributeModifiers(selectedClass);
  const raceModifiersText = formatRaceAttributeModifiers(selectedRace);
  const attributeBonusTotals = getAttributeBonusTotals(selectedClass, selectedRace);
  const selectedSaveProfCount = ATTRS.filter((attr) => draft.saveProf[attr]).length;

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
        <h2 style={sectionTitleStyle}>Character Creation Wizard</h2>
        <button onClick={onCancel} style={buttonStyle}>
          Cancel
        </button>
      </div>

      <div
        className="wizard-steps"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${stepTitles.length}, minmax(0, 1fr))`,
          gap: 8,
          marginBottom: 20,
        }}
      >
        {stepTitles.map((title, index) => {
          const status = getStepStatus(index, step);
          const isCurrent = status === "current";
          const isDone = status === "done";

          return (
            <div
              key={title}
              style={{
                padding: 10,
                borderRadius: 10,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                background: isCurrent
                  ? "rgba(73, 224, 255, 0.22)"
                  : isDone
                  ? "rgba(138, 247, 207, 0.16)"
                  : "rgba(9, 20, 38, 0.82)",
                color: isCurrent ? "#e9fdff" : isDone ? "#c9ffe8" : "var(--text-secondary)",
                border: isCurrent
                  ? "1px solid var(--accent-primary)"
                  : isDone
                  ? "1px solid rgba(138, 247, 207, 0.45)"
                  : "1px solid var(--border-soft)",
              }}
            >
              <span>{index + 1}.</span>
              <span>{title}</span>
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
            Character Name
            <input
              value={draft.identity.name}
              onChange={(e) => onNameChange(e.target.value)}
              style={inputStyle}
            />
          </label>

          <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
            Campaign
            <select
              value={draft.campaignId}
              onChange={(e) => onCampaignChange(e.target.value)}
              style={selectStyle}
            >
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>

          {selectedCampaign && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "rgba(10, 20, 39, 0.78)",
                border: "1px solid var(--border-soft)",
                color: "var(--text-primary)",
              }}
            >
              {selectedCampaign.description || "No description."}
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
            Race
            <select
              value={draft.raceId}
              onChange={(e) => onRaceChange(e.target.value)}
              style={selectStyle}
            >
              {racesForCampaign.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.name}
                </option>
              ))}
            </select>
          </label>

          {selectedRace && (
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
                <strong>{selectedRace.name}</strong>
              </div>
              <div style={{ marginTop: 4 }}>
                {selectedRace.description || "No description."}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                Modifiers: {raceModifiersText}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 14 }}>
          <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
            {labels.className}
            <select
              value={draft.classId}
              onChange={(e) => onClassChange(e.target.value)}
              style={selectStyle}
            >
              {classesForCampaign.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </label>

          {selectedClass && (
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
                <strong>{selectedClass.name}</strong>
              </div>
              <div style={{ marginTop: 4 }}>
                {selectedClass.description || "No description."}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                Hit Die: d{selectedClass.hpRule.hitDie}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                Modifiers: {classModifiersText}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gap: 14 }}>
          {(selectedClass || selectedRace) && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: "rgba(10, 20, 39, 0.78)",
                border: "1px solid var(--border-soft)",
                color: "var(--text-secondary)",
                fontSize: 14,
              }}
            >
              {selectedClass && (
                <div>
                  Class Modifiers: <strong style={{ color: "var(--text-primary)" }}>{classModifiersText}</strong>
                </div>
              )}
              {selectedRace && (
                <div style={{ marginTop: selectedClass ? 6 : 0 }}>
                  Race Modifiers: <strong style={{ color: "var(--text-primary)" }}>{raceModifiersText}</strong>
                </div>
              )}
            </div>
          )}
          <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
            Generation Method
            <select
              value={method}
              onChange={(e) =>
                onAttributeGenerationChange(
                  e.target.value as "pointBuy" | "randomRoll" | "manual"
                )
              }
              style={selectStyle}
            >
              <option value="manual">Manual</option>
              <option value="pointBuy">Point Buy</option>
              <option value="randomRoll">Random Roll</option>
            </select>
          </label>

          {method === "pointBuy" && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: "rgba(73, 224, 255, 0.18)",
                color: "var(--text-primary)",
                fontSize: 14,
                border: "1px solid var(--accent-primary)",
              }}
            >
              <strong>Point Buy:</strong> {pointBuyRemaining} / {pointBuyTotal} points remaining
            </div>
          )}

          {method === "randomRoll" && (
            <div>
              <button onClick={onRollAttributes} style={buttonStyle}>
                Roll Stats
              </button>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {ATTRS.map((attr) => {
              const baseScore = getPointBuyBaseScore(draft.attributes[attr], attributeBonusTotals[attr]);
              const pointBuyCost = method === "pointBuy" ? getPointBuyCost(baseScore) : null;
              const combinedModifier = attributeBonusTotals[attr];
              const attributeModifier = getAttributeModifier(draft.attributes[attr]);

              return (
                <div
                  key={attr}
                  style={{
                    ...statCardStyle,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    padding: 24,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span>{attr}</span>
                      {combinedModifier !== 0 && (
                        <span
                          style={{
                            fontWeight: 500,
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid var(--border-soft)",
                            borderRadius: 999,
                            padding: "1px 7px",
                            lineHeight: 1.4,
                          }}
                        >
                          {formatSignedNumber(combinedModifier)}
                        </span>
                      )}
                    </span>
                    {pointBuyCost !== null && (
                      <span style={{ fontWeight: 500, fontSize: 12, color: "var(--text-secondary)" }}>
                        {pointBuyCost} pts
                      </span>
                    )}
                  </span>
                  <label style={{ display: "flex", flexDirection: "column", fontWeight: 600, color: "#b9cdf0" }}>
                    <input
                      type="number"
                      value={draft.attributes[attr]}
                      onChange={(e) => onAttributeChange(attr, Number(e.target.value) || 0)}
                      style={{ ...inputStyle, marginTop: 0, height: 88, minHeight: 88, fontSize: 18 }}
                    />
                  </label>
                  <span style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
                    Mod: {attributeModifier >= 0 ? "+" : ""}
                    {attributeModifier}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: "rgba(73, 224, 255, 0.18)",
              color: "var(--text-primary)",
              fontSize: 14,
              border: "1px solid var(--accent-primary)",
            }}
          >
            <strong>Saving Throw Proficiencies:</strong> choose exactly 2 attributes.
            <div style={{ marginTop: 4 }}>
              Selected: {selectedSaveProfCount} / 2
            </div>
          </div>

          {ATTRS.map((attr) => {
            const checked = draft.saveProf[attr];
            const disableUnchecked = !checked && selectedSaveProfCount >= 2;

            return (
              <label
                key={attr}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: checked ? "rgba(73, 224, 255, 0.18)" : "rgba(9, 20, 38, 0.82)",
                  color: "var(--text-primary)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>
                  <strong>{attr}</strong> Save Proficiency
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disableUnchecked}
                  onChange={(e) => onSaveProfToggle(attr, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}

      {step === 5 && (
        <div style={{ display: "grid", gap: 10 }}>
          {skillChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForSkillRule(rule, draft.skills);
            return (
              <div
                key={`${index}-${rule.skillIds.join("-")}`}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(73, 224, 255, 0.18)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  border: "1px solid var(--accent-primary)",
                }}
              >
                <strong>{labels.skills}:</strong> choose exactly {rule.choose} skills.
                <div style={{ marginTop: 4 }}>
                  Selected: {selectedCount}/{rule.choose}
                </div>
              </div>
            );
          })}

          {skills.map((skill) => {
            const selectedSkill = draft.skills.find((s) => s.skillId === skill.id);
            const isSelected = selectedSkill?.proficient ?? false;
            const choiceState = getSkillChoiceState(
              skill.id,
              isSelected,
              draft.skills,
              skillChoiceRules
            );
            const canBeChosen = choiceState.canBeChosen;
            const disabled = choiceState.disabled;

            if (!canBeChosen && !isSelected) {
              return null;
            }

            return (
              <label
                key={skill.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: isSelected ? "rgba(73, 224, 255, 0.18)" : "rgba(9, 20, 38, 0.82)",
                  color: "var(--text-primary)",
                  opacity: canBeChosen ? 1 : 0.7,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>
                  <strong>{skill.name}</strong> ({skill.attribute})
                  {skill.description && (
                    <div style={{ fontWeight: 400, fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                      {skill.description}
                    </div>
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={(e) => onSkillToggle(skill.id, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}

      {step === 6 && (
        <div style={{ display: "grid", gap: 10 }}>
          {powerChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForPowerRule(rule, draft.powers);
            return (
              <div
                key={`${index}-${rule.powerIds.join("-")}`}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(73, 224, 255, 0.18)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  border: "1px solid var(--accent-primary)",
                }}
              >
                <strong>{labels.powers}:</strong> choose exactly {rule.choose} powers.
                <div style={{ marginTop: 4 }}>
                  Selected: {selectedCount} / {rule.choose}
                </div>
              </div>
            );
          })}

          {powers.map((power) => {
            const isSelected = draft.powers.some((p) => p.powerId === power.id);
            const choiceState = getPowerChoiceState(
              power.id,
              isSelected,
              draft.powers,
              powerChoiceRules
            );
            const canBeChosen = choiceState.canBeChosen;
            const disabled = choiceState.disabled;

            if (!canBeChosen && !isSelected) {
              return null;
            }

            return (
              <label
                key={power.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: isSelected ? "rgba(73, 224, 255, 0.18)" : "rgba(9, 20, 38, 0.82)",
                  color: "var(--text-primary)",
                  opacity: canBeChosen ? 1 : 0.7,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>
                  <strong>{power.name}</strong>
                  <div style={{ fontWeight: 400, fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    {power.description || "No description."}
                  </div>
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={(e) => onPowerToggle(power.id, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}

      {step === 7 && (
        <div style={{ display: "grid", gap: 10 }}>
          {itemChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForItemRule(rule, draft.inventory);
            return (
              <div
                key={`${index}-${rule.itemIds.join("-")}`}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "rgba(73, 224, 255, 0.18)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  border: "1px solid var(--accent-primary)",
                }}
              >
                <strong>{labels.inventory}:</strong> choose up to {rule.choose} items.
                <div style={{ marginTop: 4 }}>
                  Selected {selectedCount}/{rule.choose}
                </div>
              </div>
            );
          })}

          {items.map((item) => {
            const isSelected = draft.inventory.some((i) => i.itemId === item.id);
            const choiceState = getItemChoiceState(
              item.id,
              isSelected,
              draft.inventory,
              itemChoiceRules
            );
            const canBeChosen = choiceState.canBeChosen;
            const disabled = choiceState.disabled;

            if (!canBeChosen && !isSelected) {
              return null;
            }

            return (
              <label
                key={item.id}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid var(--border-soft)",
                  background: isSelected ? "rgba(73, 224, 255, 0.18)" : "rgba(9, 20, 38, 0.82)",
                  color: "var(--text-primary)",
                  opacity: canBeChosen ? 1 : 0.7,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <span>
                  <strong>{item.name}</strong>
                  <div style={{ fontWeight: 400, fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
                    {item.description || "Item"}
                  </div>
                </span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={(e) => onItemToggle(item.id, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}

      {step === 8 && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ color: "#b9cdf0" }}>
            <strong>Name:</strong> {draft.identity.name}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>Campaign:</strong> {selectedCampaign?.name}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>Race:</strong> {selectedRace?.name}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.className}:</strong> {selectedClass?.name}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.attributes}:</strong>{" "}
            {ATTRS.map((attr) => `${attr} ${draft.attributes[attr]}`).join(", ")}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>Saves:</strong>{" "}
            {ATTRS.filter((attr) => draft.saveProf[attr]).join(", ") || "None"}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.skills}:</strong>{" "}
            {draft.skills
              .filter((skill) => skill.proficient)
              .map((skill) => skills.find((s) => s.id === skill.skillId)?.name ?? skill.skillId)
              .join(", ") || "None"}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.powers}:</strong>{" "}
            {draft.powers.map((power) => power.name).join(", ") || "None"}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.inventory}:</strong>{" "}
            {draft.inventory.map((item) => `${item.name} x${item.quantity}`).join(", ") || "None"}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.attacks}:</strong>{" "}
            {[...draft.attacks].sort((a, b) => a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })).map((attack) => `${attack.name} (${attack.damage})`).join(", ") || "None"}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.hp}:</strong> {draft.hp.current} / {draft.hp.max}
          </div>
          {selectedClass && (
            <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Starting HP uses d{selectedClass.hpRule.hitDie} + CON modifier.
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 24,
        }}
      >
        <button onClick={onBack} disabled={step === 0} style={buttonStyle}>
          Back
        </button>

        {step < stepTitles.length - 1 ? (
          <button onClick={onNext} style={buttonStyle}>
            Next
          </button>
        ) : (
          <button onClick={onFinish} style={buttonStyle}>
            Finish Character
          </button>
        )}
      </div>
    </section>
  );
}