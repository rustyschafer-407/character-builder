export const pageStyle: React.CSSProperties = {
  padding: 24,
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  maxWidth: 1180,
  margin: "0 auto",
  color: "var(--cb-text)",
};

export const panelStyle: React.CSSProperties = {
  background: "linear-gradient(165deg, var(--cb-surface-raised), var(--cb-surface))",
  border: "1px solid var(--cb-border)",
  borderRadius: 14,
  padding: 16,
  boxShadow: "var(--cb-card-shadow)",
  backdropFilter: "blur(6px)",
  animation: "rise-in 260ms ease-out both",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0 var(--cb-control-padding-x)",
  height: "var(--cb-control-height)",
  minHeight: "var(--cb-control-height)",
  lineHeight: "1.2",
  marginTop: 4,
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid var(--cb-input-border)",
  background: "var(--cb-input-bg)",
  color: "var(--cb-text)",
  fontSize: 14,
  outline: "none",
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  padding: "0 12px",
  lineHeight: "1.2",
};

export const buttonStyle: React.CSSProperties = {
  minHeight: "var(--cb-control-height)",
  padding: "0 var(--cb-control-padding-x)",
  borderRadius: 10,
  border: "1px solid var(--cb-border-strong)",
  background: "var(--cb-button-bg)",
  color: "var(--cb-text)",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: "1.2",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
  boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
};

export const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(135deg, var(--cb-accent), var(--cb-accent-hover))",
  border: "1px solid var(--cb-accent)",
  color: "var(--cb-accent-contrast)",
  boxShadow: "0 8px 24px var(--cb-accent-soft-strong)",
};

export const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "var(--cb-button-danger-bg)",
  border: "1px solid var(--cb-button-danger-border)",
  color: "var(--cb-button-danger-text)",
  padding: "0 12px",
};

export const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  color: "var(--cb-text)",
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontWeight: 700,
  letterSpacing: "0.01em",
};

export const mutedTextStyle: React.CSSProperties = {
  color: "var(--cb-text-muted)",
};

export const labelTextStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  color: "var(--cb-muted-label)",
};

export const cardStyle: React.CSSProperties = {
  border: "1px solid var(--cb-border)",
  borderRadius: 10,
  padding: 12,
  background: "var(--cb-surface)",
};

export const statCardStyle: React.CSSProperties = {
  border: "1px solid var(--cb-border)",
  borderRadius: 12,
  padding: 12,
  background: "var(--cb-surface-raised)",
};