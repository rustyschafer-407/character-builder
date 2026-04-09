import type { CharacterRecord } from "../types/character";
import type { ClassDefinition, CampaignDefinition } from "../types/gameData";
import {
  dangerButtonStyle,
  inputStyle,
  labelTextStyle,
  mutedTextStyle,
  panelStyle,
  primaryButtonStyle,
} from "./uiStyles";

interface Props {
  campaigns: CampaignDefinition[];
  classesForSelectedCampaign: ClassDefinition[];
  characters: CharacterRecord[];
  selectedId: string;
  newCampaignId: string;
  newClassId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onCampaignChange: (id: string) => void;
  onClassChange: (id: string) => void;
  getCampaignName: (campaignId: string) => string;
  getClassName: (classId: string) => string;
}

export default function Sidebar({
  campaigns,
  classesForSelectedCampaign,
  characters,
  selectedId,
  newCampaignId,
  newClassId,
  onSelect,
  onCreate,
  onDelete,
  onCampaignChange,
  onClassChange,
  getCampaignName,
  getClassName,
}: Props) {
  return (
    <aside
      style={{
        ...panelStyle,
        width: 300,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16, color: "var(--text-primary)" }}>Characters</h2>

      <div style={{ display: "grid", gap: 8 }}>
        <label style={labelTextStyle}>
          Campaign
          <select value={newCampaignId} onChange={(e) => onCampaignChange(e.target.value)} style={inputStyle}>
            {campaigns.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        <label style={labelTextStyle}>
          Class
          <select value={newClassId} onChange={(e) => onClassChange(e.target.value)} style={inputStyle}>
            {classesForSelectedCampaign.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </label>

        <button onClick={onCreate} style={primaryButtonStyle}>
          New Character
        </button>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
        {characters.length === 0 && <p style={{ margin: 0, ...mutedTextStyle }}>No characters yet.</p>}

        {characters.map((c) => {
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