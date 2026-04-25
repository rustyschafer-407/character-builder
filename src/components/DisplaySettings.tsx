import {
  DENSITY_OPTIONS,
  TEXT_SIZE_OPTIONS,
  THEME_OPTIONS,
  type CbDensity,
  type CbTextSize,
  type CbTheme,
} from "../lib/displayPreferences";
import { inputStyle } from "./uiStyles";

interface Props {
  theme: CbTheme;
  textSize: CbTextSize;
  density: CbDensity;
  onThemeChange: (nextTheme: CbTheme) => void;
  onTextSizeChange: (nextTextSize: CbTextSize) => void;
  onDensityChange: (nextDensity: CbDensity) => void;
}

export default function DisplaySettings({
  theme,
  textSize,
  density,
  onThemeChange,
  onTextSizeChange,
  onDensityChange,
}: Props) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid var(--cb-border)",
        background: "var(--cb-surface)",
        minWidth: 320,
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: "0.03em", fontWeight: 700, color: "var(--cb-text-muted)" }}>DISPLAY</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 4, color: "var(--cb-text-muted)", fontSize: 12, fontWeight: 600 }}>
          Theme
          <select
            className="form-control"
            style={{ ...inputStyle, marginTop: 0, fontSize: 13 }}
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as CbTheme)}
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, color: "var(--cb-text-muted)", fontSize: 12, fontWeight: 600 }}>
          Text Size
          <select
            className="form-control"
            style={{ ...inputStyle, marginTop: 0, fontSize: 13 }}
            value={textSize}
            onChange={(event) => onTextSizeChange(event.target.value as CbTextSize)}
          >
            {TEXT_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4, color: "var(--cb-text-muted)", fontSize: 12, fontWeight: 600 }}>
          Density
          <select
            className="form-control"
            style={{ ...inputStyle, marginTop: 0, fontSize: 13 }}
            value={density}
            onChange={(event) => onDensityChange(event.target.value as CbDensity)}
          >
            {DENSITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
