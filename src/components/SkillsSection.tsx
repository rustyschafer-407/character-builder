import type { CharacterRecord } from "../types/character";
import type { ClassSkillChoiceRule, SkillDefinition } from "../types/gameData";
import { getAttributeModifier } from "../lib/character";
import { cardStyle, inputStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  skills: SkillDefinition[];
  label: string;
  skillChoiceRules: ClassSkillChoiceRule[];
  onChange: (
    id: string,
    field: "proficient" | "bonus",
    value: boolean | number
  ) => void;
}

function getRuleForSkill(
  skillId: string,
  rules: ClassSkillChoiceRule[]
): ClassSkillChoiceRule | undefined {
  return rules.find((rule) => rule.skillIds.includes(skillId));
}

function getSelectedCountForRule(
  rule: ClassSkillChoiceRule,
  character: CharacterRecord
) {
  return character.skills.filter(
    (skill) => rule.skillIds.includes(skill.skillId) && skill.proficient
  ).length;
}

export default function SkillsSection({
  character,
  skills,
  label,
  skillChoiceRules,
  onChange,
}: Props) {
  const hasChoiceRules = skillChoiceRules.length > 0;

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>{label}</h2>

      {hasChoiceRules && (
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {skillChoiceRules.map((rule, index) => {
            const selectedCount = getSelectedCountForRule(rule, character);
            const remaining = rule.choose - selectedCount;

            return (
              <div
                key={`${index}-${rule.skillIds.join("-")}`}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background: "#eff6ff",
                  color: "#1e3a8a",
                  fontSize: 14,
                }}
              >
                <strong>Skill Picks:</strong> choose {rule.choose} from{" "}
                {rule.skillIds
                  .map((id) => skills.find((s) => s.id === id)?.name ?? id)
                  .join(", ")}
                <div style={{ marginTop: 4 }}>
                  Remaining: <strong>{remaining}</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        {skills.map((s) => {
          const skill = character.skills.find((x) => x.skillId === s.id);
          if (!skill) return null;

          const base = getAttributeModifier(character.attributes[s.attribute]);
          const total =
            base +
            (skill.proficient ? character.proficiencyBonus : 0) +
            skill.bonus;

          const rule = getRuleForSkill(s.id, skillChoiceRules);
          const selectedCount = rule ? getSelectedCountForRule(rule, character) : 0;
          const remaining = rule ? rule.choose - selectedCount : 0;

          const canBeChosen = !hasChoiceRules || Boolean(rule);
          const disableProfCheckbox =
            !skill.proficient &&
            ((hasChoiceRules && !canBeChosen) || (rule ? remaining <= 0 : false));

          return (
            <div
              key={s.id}
              style={{
                ...cardStyle,
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                gap: 8,
                alignItems: "center",
                opacity: !canBeChosen ? 0.7 : 1,
              }}
            >
              <div style={{ color: "var(--text-primary)" }}>
                <strong>{s.name}</strong> ({s.attribute})
              </div>

              <label style={{ color: "#b9cdf0", fontSize: 14 }}>
                Prof
                <input
                  type="checkbox"
                  checked={skill.proficient}
                  disabled={disableProfCheckbox}
                  onChange={(e) => onChange(s.id, "proficient", e.target.checked)}
                  style={{ marginLeft: 8 }}
                />
              </label>

              <div style={{ color: "var(--text-secondary)" }}>
                Base: {base >= 0 ? "+" : ""}
                {base}
              </div>

              <label style={{ color: "#b9cdf0", fontSize: 14 }}>
                Bonus
                <input
                  type="number"
                  value={skill.bonus}
                  onChange={(e) => onChange(s.id, "bonus", Number(e.target.value) || 0)}
                  style={{
                    ...inputStyle,
                    width: 70,
                    marginLeft: 8,
                    marginTop: 0,
                    display: "inline-block",
                  }}
                />
              </label>

              <div style={{ color: "var(--text-primary)" }}>
                Total: <strong>{total >= 0 ? "+" : ""}{total}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}