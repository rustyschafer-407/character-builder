import type { CharacterRecord } from "../types/character";
import { inputStyle, labelTextStyle, panelStyle, sectionTitleStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  campaignName: string;
  classLabel: string;
  className: string;
  levelLabel: string;
  hpLabel: string;
  onNameChange: (name: string) => void;
}

export default function IdentitySection({
  character,
  campaignName,
  classLabel,
  className,
  levelLabel,
  hpLabel,
  onNameChange,
}: Props) {
  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h2 style={sectionTitleStyle}>Identity</h2>
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

        <div style={{ color: "#b9cdf0" }}>
          <strong>Campaign:</strong> {campaignName}
        </div>

        <div style={{ color: "#b9cdf0" }}>
          <strong>{classLabel}:</strong> {className}
        </div>

        <div style={{ color: "#b9cdf0" }}>
          <strong>{levelLabel}:</strong> {character.level}
        </div>

        <div style={{ color: "#b9cdf0" }}>
          <strong>{hpLabel}:</strong> {character.hp.current}/{character.hp.max}
        </div>
      </div>
    </section>
  );
}