import type { CharacterRecord } from "../types/character";
import type { SkillDefinition } from "../types/gameData";
import { getAttributeModifier } from "../lib/character";
import { cardStyle, inputStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  skills: SkillDefinition[];
  label: string;
  onChange: (
    id: string,
    field: "proficient" | "bonus",
    value: boolean | number
  ) => void;
}

export default function SkillsSection({
  character,
  skills,
  label,
  onChange,
}: Props) {
  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>{label}</h2>

      <div style={{ display: "grid", gap: 8 }}>
        {skills.map((s) => {
          const skill = character.skills.find((x) => x.skillId === s.id);
          if (!skill) return null;

          const skillAttribute = skill.attribute ?? s.attribute;

          const base = getAttributeModifier(character.attributes[skillAttribute]);
          const total =
            base +
            (skill.proficient ? character.proficiencyBonus : 0) +
            skill.bonus;

          return (
            <div
              key={s.id}
              style={{
                ...cardStyle,
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
                gap: 8,
                alignItems: "center",
              }}
            >
              <div style={{ color: "var(--text-primary)" }}>
                <strong>{s.name}</strong> ({skillAttribute})
              </div>

              <label style={{ color: "var(--cb-muted-label)", fontSize: 14 }}>
                Prof
                <input
                  type="checkbox"
                  checked={skill.proficient}
                  onChange={(e) => onChange(s.id, "proficient", e.target.checked)}
                  style={{ marginLeft: 8 }}
                />
              </label>

              <div style={{ color: "var(--text-secondary)" }}>
                Base: {base >= 0 ? "+" : ""}
                {base}
              </div>

              <label style={{ color: "var(--cb-muted-label)", fontSize: 14 }}>
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