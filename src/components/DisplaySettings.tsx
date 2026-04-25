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
  themeValue: CbTheme | "default";
  textSize: CbTextSize;
  density: CbDensity;
  isCampaignThemeScope: boolean;
  onThemeChange: (nextTheme: CbTheme | "default") => void;
  onTextSizeChange: (nextTextSize: CbTextSize) => void;
  onDensityChange: (nextDensity: CbDensity) => void;
}

export default function DisplaySettings({
  themeValue,
  textSize,
  density,
  isCampaignThemeScope,
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
          {isCampaignThemeScope ? "Theme for this campaign" : "Default theme"}
          <select
            className="form-control"
            style={{ ...inputStyle, marginTop: 0, fontSize: 13 }}
            value={themeValue}
            onChange={(event) => onThemeChange(event.target.value as CbTheme | "default")}
          >
            {isCampaignThemeScope ? <option value="default">Use default theme</option> : null}
            {THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span style={{ color: "var(--cb-text-muted)", fontSize: 11, lineHeight: 1.4 }}>
            {isCampaignThemeScope
              ? "Saved to your account. Only affects how this campaign looks for you."
              : "Saved as your default theme for campaigns without an override."}
          </span>
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
