import type { CharacterRecord } from "../types/character";
import {
  dangerButtonStyle,
  mutedTextStyle,
  panelStyle,
  primaryButtonStyle,
} from "./uiStyles";

interface Props {
  characters: CharacterRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  getCampaignName: (campaignId: string) => string;
  getClassName: (classId: string) => string;
}

export default function Sidebar({
  characters,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  getCampaignName,
  getClassName,
}: Props) {
  const sortedCharacters = [...characters].sort((a, b) => {
    const aName = a.identity.name?.trim() || "Unnamed Character";
    const bName = b.identity.name?.trim() || "Unnamed Character";
    return aName.localeCompare(bName);
  });

  return (
    <aside
      style={{
        ...panelStyle,
        width: 300,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16, color: "var(--text-primary)" }}>Characters</h2>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onCreate}
          style={{
            ...primaryButtonStyle,
            flex: 1,
            justifyContent: "center",
            padding: "12px 14px",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.01em",
            boxShadow: "0 8px 18px rgba(73, 224, 255, 0.2)",
          }}
        >
          New Character
        </button>

        <div
          aria-hidden
          style={{
            ...dangerButtonStyle,
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          ✕
        </div>
      </div>

      <div style={{ marginTop: 24, display: "grid", gap: 8 }}>
        {sortedCharacters.length === 0 && <p style={{ margin: 0, ...mutedTextStyle }}>No characters yet.</p>}

        {sortedCharacters.map((c) => {
          const isSelected = c.id === selectedId;
          const displayName = c.identity.name?.trim() || "Unnamed Character";

          return (
            <div key={c.id} style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => onSelect(c.id)}
                style={{
                  flex: 1,
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 8,
                  border: isSelected ? "1px solid var(--accent-primary)" : "1px solid var(--border-soft)",
                  background: isSelected ? "rgba(73, 224, 255, 0.16)" : "rgba(11, 22, 42, 0.75)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <strong style={{ display: "block", color: "var(--text-primary)" }}>{displayName}</strong>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {getCampaignName(c.campaignId)} • {getClassName(c.classId)}
                </div>
              </button>

              <button onClick={() => onDelete(c.id)} style={dangerButtonStyle}>
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}