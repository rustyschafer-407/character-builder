export const pageStyle: React.CSSProperties = {
  padding: 24,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  maxWidth: 1180,
  margin: "0 auto",
  color: "#1f2937",
};

export const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  marginTop: 4,
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
};

export const buttonStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#111827",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

export const primaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#2563eb",
  border: "1px solid #1d4ed8",
  color: "#ffffff",
};

export const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#fee2e2",
  border: "1px solid #fca5a5",
  color: "#991b1b",
  padding: "0 8px",
};

export const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  color: "#111827",
};

export const mutedTextStyle: React.CSSProperties = {
  color: "#6b7280",
};

export const labelTextStyle: React.CSSProperties = {
  fontWeight: 600,
  color: "#374151",
};

export const cardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 10,
  background: "#ffffff",
};

export const statCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  background: "#f9fafb",
};