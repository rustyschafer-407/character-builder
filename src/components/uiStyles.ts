export const pageStyle: React.CSSProperties = {
  padding: 24,
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  maxWidth: 1180,
  margin: "0 auto",
  color: "var(--text-primary)",
};

export const panelStyle: React.CSSProperties = {
  background: "linear-gradient(165deg, var(--surface-1), var(--surface-0))",
  border: "1px solid var(--border-soft)",
  borderRadius: 14,
  padding: 16,
  boxShadow: "var(--shadow-elev)",
  backdropFilter: "blur(6px)",
  animation: "rise-in 260ms ease-out both",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  height: 44,
  minHeight: 44,
  lineHeight: "22px",
  marginTop: 4,
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid #3a4e7f",
  background: "rgba(8, 16, 31, 0.82)",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
};

export const buttonStyle: React.CSSProperties = {
  padding: "9px 13px",
  borderRadius: 10,
  border: "1px solid var(--border-bright)",
  background: "rgba(16, 30, 58, 0.92)",
  color: "var(--text-primary)",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
  boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
};

export const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(135deg, var(--accent-primary), var(--accent-primary-strong))",
  border: "1px solid #33d6ff",
  color: "#001321",
  boxShadow: "0 8px 24px rgba(73, 224, 255, 0.28)",
};

export const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "rgba(255, 122, 157, 0.18)",
  border: "1px solid rgba(255, 122, 157, 0.45)",
  color: "#ffd6e2",
  padding: "0 8px",
};

export const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  color: "var(--text-primary)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontWeight: 700,
  letterSpacing: "0.01em",
};

export const mutedTextStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
};

export const labelTextStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  color: "#b9cdf0",
};

export const cardStyle: React.CSSProperties = {
  border: "1px solid #324977",
  borderRadius: 10,
  padding: 10,
  background: "rgba(11, 22, 42, 0.72)",
};

export const statCardStyle: React.CSSProperties = {
  border: "1px solid #2c426c",
  borderRadius: 12,
  padding: 12,
  background: "rgba(14, 28, 50, 0.74)",
};