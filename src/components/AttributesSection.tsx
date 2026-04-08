import type { CharacterRecord } from "../types/character";
import type { AttributeKey } from "../types/gameData";
import { getAttributeModifier } from "../lib/character";
import { buttonStyle, inputStyle, panelStyle, sectionTitleStyle, statCardStyle } from "./uiStyles";

const ATTRS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

interface Props {
  character: CharacterRecord;
  label: string;
  onChange: (k: AttributeKey, v: number) => void;
  onGenerationChange: (method: "pointBuy" | "randomRoll" | "manual") => void;
  onApplyRolls: (values: number[]) => void;
  pointBuyTotal?: number;
  pointBuyRemaining?: number;
}

export default function AttributesSection({
  character,
  label,
  onChange,
  onGenerationChange,
  onApplyRolls,
  pointBuyTotal,
  pointBuyRemaining,
}: Props) {
  const method = character.attributeGeneration?.method ?? "manual";

  function rollStats() {
    const rolls = Array.from({ length: 6 }).map(() => {
      const dice = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
      dice.sort((a, b) => b - a);
      return dice[0] + dice[1] + dice[2];
    });

    onApplyRolls(rolls);
  }

  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>{label}</h2>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600, color: "#374151" }}>
          Generation Method
          <select
            value={method}
            onChange={(e) =>
              onGenerationChange(e.target.value as "pointBuy" | "randomRoll" | "manual")
            }
            style={inputStyle}
          >
            <option value="manual">Manual</option>
            <option value="pointBuy">Point Buy</option>
            <option value="randomRoll">Random Roll</option>
          </select>
        </label>
      </div>

      {method === "pointBuy" && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 8,
            background: "#eff6ff",
            color: "#1e3a8a",
            fontSize: 14,
          }}
        >
          <strong>Point Buy:</strong> {pointBuyRemaining} / {pointBuyTotal} points remaining
        </div>
      )}

      {method === "randomRoll" && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={rollStats} style={buttonStyle}>
            Roll Stats (4d6 drop lowest)
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
          <div key={attr} style={statCardStyle}>
            <strong style={{ color: "#111827" }}>{attr}</strong>

            <div style={{ marginTop: 8 }}>
              <input
                type="number"
                value={character.attributes[attr]}
                onChange={(e) => onChange(attr, Number(e.target.value) || 0)}
                style={inputStyle}
              />
            </div>

            <div style={{ marginTop: 8, fontSize: 14, color: "#4b5563" }}>
              Mod: {getAttributeModifier(character.attributes[attr]) >= 0 ? "+" : ""}
              {getAttributeModifier(character.attributes[attr])}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}