import type { CharacterRecord } from "../types/character";
import type { AttributeKey } from "../types/gameData";
import { getAttributeModifier } from "../lib/character";
import { inputStyle, panelStyle, sectionTitleStyle, statCardStyle } from "./uiStyles";

const ATTRS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

interface Props {
  character: CharacterRecord;
  label: string;
  onChange: (k: AttributeKey, v: number) => void;
}

export default function AttributesSection({
  character,
  label,
  onChange,
}: Props) {
  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>{label}</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {ATTRS.map((attr) => (
          <div key={attr} style={statCardStyle}>
            <strong style={{ color: "var(--text-primary)" }}>{attr}</strong>

            <div style={{ marginTop: 8 }}>
              <input
                type="number"
                value={character.attributes[attr]}
                onChange={(e) => onChange(attr, Number(e.target.value) || 0)}
                className="form-control" style={inputStyle}
              />
            </div>

            <div style={{ marginTop: 8, fontSize: 14, color: "var(--text-secondary)" }}>
              Mod: {getAttributeModifier(character.attributes[attr]) >= 0 ? "+" : ""}
              {getAttributeModifier(character.attributes[attr])}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}