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
  const scopeMessage = isCampaignThemeScope
    ? "Saved to your account. Only affects how this campaign looks for you."
    : "Saved to your account. Used for campaigns without an override.";

  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        padding: 20,
        borderRadius: 14,
        border: "1px solid var(--cb-border)",
        background: "linear-gradient(165deg, var(--cb-surface-raised), var(--cb-surface))",
        minWidth: 0,
      }}
    >
      <label style={{ display: "grid", gap: 8, color: "var(--cb-text-muted)", fontSize: 12, fontWeight: 600 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "var(--cb-text-muted)" }}>
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 20,
              height: 20,
              borderRadius: 6,
              border: "1px solid var(--cb-display-icon-border)",
              background: "var(--cb-display-icon-bg)",
              color: "var(--cb-display-icon-fg)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="8" cy="10" r="1.5" fill="currentColor" />
              <circle cx="14.5" cy="8" r="1.5" fill="currentColor" />
              <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" />
            </svg>
          </span>
          {isCampaignThemeScope ? "Theme for this campaign" : "Default theme"}
        </div>
        <select
          className="form-control"
          style={{
            ...inputStyle,
            marginTop: 0,
            fontSize: 16,
            borderColor: "var(--cb-border-strong)",
          }}
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
      </label>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
        }}
      >
        <label style={{ display: "grid", gap: 8, color: "var(--cb-text-muted)", fontSize: 12, fontWeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "var(--cb-text-muted)" }}>
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 20,
                borderRadius: 6,
                border: "1px solid var(--cb-display-icon-border)",
                background: "var(--cb-display-icon-bg)",
                color: "var(--cb-display-icon-fg)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 18h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M6.5 7v11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M13 18h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M16.5 5v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            Text Size
          </div>
          <select
            className="form-control"
            style={{ ...inputStyle, marginTop: 0, fontSize: 16 }}
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

        <label style={{ display: "grid", gap: 8, color: "var(--cb-text-muted)", fontSize: 12, fontWeight: 600 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "var(--cb-text-muted)" }}>
            <span
              aria-hidden
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 20,
                height: 20,
                borderRadius: 6,
                border: "1px solid var(--cb-display-icon-border)",
                background: "var(--cb-display-icon-bg)",
                color: "var(--cb-display-icon-fg)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="4" y="4" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="10" y="4" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="16" y="4" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="4" y="10" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="10" y="10" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="16" y="10" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="4" y="16" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="10" y="16" width="4" height="4" rx="1" fill="currentColor" />
                <rect x="16" y="16" width="4" height="4" rx="1" fill="currentColor" />
              </svg>
            </span>
            Density
          </div>
          <select
            className="form-control"
            style={{ ...inputStyle, marginTop: 0, fontSize: 14 }}
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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingTop: 14,
          borderTop: "1px solid var(--cb-border)",
          color: "var(--cb-text-muted)",
          fontSize: 14,
          lineHeight: 1.4,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            border: "1px solid var(--cb-display-icon-border)",
            background: "var(--cb-display-icon-bg)",
            color: "var(--cb-display-icon-fg)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5 19c1.6-2.8 4.1-4.2 7-4.2S17.4 16.2 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span>{scopeMessage}</span>
      </div>
    </div>
  );
}
