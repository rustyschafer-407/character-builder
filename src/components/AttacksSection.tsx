import { getAttributeModifier, sortByName } from "../lib/character";
import type { CharacterRecord } from "../types/character";
import { buttonStyle, cardStyle, inputStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  label: string;
  onAdd: () => void;
  onChange: (id: string, field: "name" | "damage" | "bonus", value: string | number) => void;
}

export default function AttacksSection({ character, label, onAdd, onChange }: Props) {
  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={sectionTitleStyle}>{label}</h2>
        <button onClick={onAdd} style={buttonStyle}>
          Add Attack
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {sortByName(character.attacks).map((a) => {
          const total = getAttributeModifier(character.attributes[a.attribute]) + a.bonus;

          return (
            <div
              key={a.id}
              style={{
                ...cardStyle,
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                value={a.name}
                onChange={(e) => onChange(a.id, "name", e.target.value)}
                style={inputStyle}
              />
              <input
                value={a.damage}
                onChange={(e) => onChange(a.id, "damage", e.target.value)}
                style={inputStyle}
              />
              <input
                type="number"
                value={a.bonus}
                onChange={(e) => onChange(a.id, "bonus", Number(e.target.value) || 0)}
                style={inputStyle}
              />
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