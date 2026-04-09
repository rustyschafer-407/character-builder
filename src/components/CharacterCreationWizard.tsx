import type {
  CharacterAttack,
  CharacterAttributeGeneration,
  CharacterHp,
  CharacterIdentity,
  CharacterItem,
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
  SkillDefinition,
} from "../types/gameData";
import { buttonStyle, inputStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

export interface CharacterCreationDraft {
  identity: CharacterIdentity;
  campaignId: string;
  classId: string;
  level: number;
  proficiencyBonus: number;
  attributes: Record<AttributeKey, number>;
  attributeGeneration?: CharacterAttributeGeneration;
  hp: CharacterHp;
  skills: CharacterSkillSelection[];
  powers: CharacterPowerSelection[];
  inventory: CharacterItem[];
  attacks: CharacterAttack[];
}

interface Props {
  step: number;
  draft: CharacterCreationDraft;
  campaigns: CampaignDefinition[];
  classesForCampaign: ClassDefinition[];
  selectedCampaign: CampaignDefinition | null;
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
  onClassChange: (classId: string) => void;
  onAttributeGenerationChange: (method: "pointBuy" | "randomRoll" | "manual") => void;
  onAttributeChange: (key: AttributeKey, value: number) => void;
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
    labels.className,
    labels.attributes,
    labels.skills,
    labels.powers,
    labels.inventory,
    "Review",
  ];
}

function getRuleForSkill(skillId: string, rules: ClassSkillChoiceRule[]) {
  return rules.find((rule) => rule.skillIds.includes(skillId));
}

function getSelectedCountForSkillRule(
  rule: ClassSkillChoiceRule,
  draft: CharacterCreationDraft
) {
  return draft.skills.filter(
    (skill) => rule.skillIds.includes(skill.skillId) && skill.proficient
  ).length;
}

function getRuleForPower(powerId: string, rules: ClassPowerChoiceRule[]) {
  return rules.find((rule) => rule.powerIds.includes(powerId));
}

function getSelectedCountForPowerRule(
  rule: ClassPowerChoiceRule,
  draft: CharacterCreationDraft
) {
  return draft.powers.filter(
    (power) => power.powerId && rule.powerIds.includes(power.powerId)
  ).length;
}

function getRuleForItem(itemId: string, rules: ClassItemChoiceRule[]) {
  return rules.find((rule) => rule.itemIds.includes(itemId));
}

function getSelectedCountForItemRule(
  rule: ClassItemChoiceRule,
  draft: CharacterCreationDraft
) {
  return draft.inventory.filter(
    (item) => item.itemId && rule.itemIds.includes(item.itemId)
  ).length;
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

export default function CharacterCreationWizard({
  step,
  draft,
  campaigns,
  classesForCampaign,
  selectedCampaign,
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
  onClassChange,
  onAttributeGenerationChange,
  onAttributeChange,
  onRollAttributes,
  onSkillToggle,
  onPowerToggle,
  onItemToggle,
  onBack,
  onNext,
  onCancel,
  onFinish,
}: Props) {
  const method = draft.attributeGeneration?.method ?? "manual";
  const stepTitles = getStepTitles(labels);
  const classModifiersText = formatClassAttributeModifiers(selectedClass);

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
              {index + 1}. {title}
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
              style={inputStyle}
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
            {labels.className}
            <select
              value={draft.classId}
              onChange={(e) => onClassChange(e.target.value)}
              style={inputStyle}
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

      {step === 2 && (
        <div style={{ display: "grid", gap: 14 }}>
          {selectedClass && (
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
              Class Modifiers: <strong style={{ color: "var(--text-primary)" }}>{classModifiersText}</strong>
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
              style={inputStyle}
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
            {ATTRS.map((attr) => (
              <label key={attr} style={{ fontWeight: 600, color: "#b9cdf0" }}>
                {attr}
                <input
                  type="number"
                  value={draft.attributes[attr]}
                  onChange={(e) => onAttributeChange(attr, Number(e.target.value) || 0)}
                  style={inputStyle}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gap: 10 }}>
          {skillChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForSkillRule(rule, draft);
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
                <strong>{labels.skills} Picks:</strong> choose {rule.choose} from{" "}
                {rule.skillIds
                  .map((id) => skills.find((s) => s.id === id)?.name ?? id)
                  .join(", ")}
                <div style={{ marginTop: 4 }}>
                  Selected: {selectedCount} / {rule.choose}
                </div>
              </div>
            );
          })}

          {skills.map((skill) => {
            const selectedSkill = draft.skills.find((s) => s.skillId === skill.id);
            const isSelected = selectedSkill?.proficient ?? false;
            const rule = getRuleForSkill(skill.id, skillChoiceRules);
            const selectedCount = rule ? getSelectedCountForSkillRule(rule, draft) : 0;
            const remaining = rule ? rule.choose - selectedCount : 0;
            const canBeChosen = skillChoiceRules.length === 0 || Boolean(rule) || isSelected;
            const disabled =
              !isSelected &&
              ((skillChoiceRules.length > 0 && !canBeChosen) || (rule ? remaining <= 0 : false));

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

      {step === 4 && (
        <div style={{ display: "grid", gap: 10 }}>
          {powerChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForPowerRule(rule, draft);
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
                <strong>{labels.powers} Picks:</strong> choose {rule.choose} from{" "}
                {rule.powerIds
                  .map((id) => powers.find((p) => p.id === id)?.name ?? id)
                  .join(", ")}
                <div style={{ marginTop: 4 }}>
                  Selected: {selectedCount} / {rule.choose}
                </div>
              </div>
            );
          })}

          {powers.map((power) => {
            const isSelected = draft.powers.some((p) => p.powerId === power.id);
            const rule = getRuleForPower(power.id, powerChoiceRules);
            const selectedCount = rule ? getSelectedCountForPowerRule(rule, draft) : 0;
            const remaining = rule ? rule.choose - selectedCount : 0;
            const canBeChosen = powerChoiceRules.length === 0 || Boolean(rule) || isSelected;
            const disabled =
              !isSelected &&
              ((powerChoiceRules.length > 0 && !canBeChosen) || (rule ? remaining <= 0 : false));

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

      {step === 5 && (
        <div style={{ display: "grid", gap: 10 }}>
          {itemChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForItemRule(rule, draft);
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
                <strong>{labels.inventory} Picks:</strong> choose {rule.choose} from{" "}
                {rule.itemIds
                  .map((id) => items.find((i) => i.id === id)?.name ?? id)
                  .join(", ")}
                <div style={{ marginTop: 4 }}>
                  Selected: {selectedCount} / {rule.choose}
                </div>
              </div>
            );
          })}

          {items.map((item) => {
            const isSelected = draft.inventory.some((i) => i.itemId === item.id);
            const rule = getRuleForItem(item.id, itemChoiceRules);
            const selectedCount = rule ? getSelectedCountForItemRule(rule, draft) : 0;
            const remaining = rule ? rule.choose - selectedCount : 0;
            const canBeChosen = itemChoiceRules.length === 0 || Boolean(rule) || isSelected;
            const disabled =
              !isSelected &&
              ((itemChoiceRules.length > 0 && !canBeChosen) || (rule ? remaining <= 0 : false));

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
                    {item.description || item.category || "Item"}
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

      {step === 6 && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ color: "#b9cdf0" }}>
            <strong>Name:</strong> {draft.identity.name}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>Campaign:</strong> {selectedCampaign?.name}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.className}:</strong> {selectedClass?.name}
          </div>
          <div style={{ color: "#b9cdf0" }}>
            <strong>{labels.attributes}:</strong>{" "}
            {ATTRS.map((attr) => `${attr} ${draft.attributes[attr]}`).join(", ")}
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
            {draft.attacks.map((attack) => `${attack.name} (${attack.damage})`).join(", ") || "None"}
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