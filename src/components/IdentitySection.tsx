import type { CharacterRecord } from "../types/character";
import { buttonStyle, inputStyle, labelTextStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  genreName: string;
  classLabel: string;
  className: string;
  levelLabel: string;
  hpLabel: string;
  onNameChange: (name: string) => void;
  onExport: () => void;
}

export default function IdentitySection({
  character,
  genreName,
  classLabel,
  className,
  levelLabel,
  hpLabel,
  onNameChange,
  onExport,
}: Props) {
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
        <h2 style={sectionTitleStyle}>Identity</h2>
        <button onClick={onExport} style={buttonStyle}>
          Export JSON
        </button>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <label style={labelTextStyle}>
          Name
          <input
            value={character.identity.name}
            onChange={(e) => onNameChange(e.target.value)}
            style={inputStyle}
          />
        </label>

        <div style={{ color: "#374151" }}>
          <strong>Genre:</strong> {genreName}
        </div>

        <div style={{ color: "#374151" }}>
          <strong>{classLabel}:</strong> {className}
        </div>

        <div style={{ color: "#374151" }}>
          <strong>{levelLabel}:</strong> {character.level}
        </div>

        <div style={{ color: "#374151" }}>
          <strong>{hpLabel}:</strong> {character.hp.current}/{character.hp.max}
        </div>
      </div>
    </section>
  );
}