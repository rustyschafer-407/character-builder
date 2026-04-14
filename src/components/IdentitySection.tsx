import { useEffect, useState } from "react";
import type { CharacterRecord } from "../types/character";
import { buttonStyle, inputStyle, labelTextStyle, panelStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  campaignName: string;
  raceName: string;
  classLabel: string;
  className: string;
  levelLabel: string;
  hpLabel: string;
  onNameChange: (name: string) => void;
  onOpenLevelUpWizard: () => void;
}

export default function IdentitySection({
  character,
  campaignName,
  raceName,
  classLabel,
  className,
  levelLabel,
  hpLabel,
  onNameChange,
  onOpenLevelUpWizard,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(character.identity.name);

  useEffect(() => {
    if (!editingName) {
      setDraftName(character.identity.name);
    }
  }, [character.identity.name, editingName]);

  function startNameEdit() {
    setDraftName(character.identity.name);
    setEditingName(true);
  }

  function saveNameEdit() {
    const nextName = draftName.trim();
    onNameChange(nextName || character.identity.name);
    setEditingName(false);
  }

  function cancelNameEdit() {
    setDraftName(character.identity.name);
    setEditingName(false);
  }

  return (
    <section style={panelStyle}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 8 }}>
          {!editingName ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  lineHeight: 1.05,
                  color: "var(--text-primary)",
                }}
              >
                {character.identity.name || "Unnamed Character"}
              </div>
              <button onClick={startNameEdit} style={{ ...buttonStyle, padding: "6px 10px" }}>
                Edit
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <label style={labelTextStyle}>
                Name
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveNameEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelNameEdit();
                    }
                  }}
                  style={inputStyle}
                  autoFocus
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveNameEdit} style={{ ...buttonStyle, padding: "6px 10px" }} aria-label="Save name">
                  ✓
                </button>
                <button onClick={cancelNameEdit} style={{ ...buttonStyle, padding: "6px 10px" }} aria-label="Cancel name edit">
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ color: "#b9cdf0" }}>
          <strong>Campaign:</strong> {campaignName}
        </div>

        <div style={{ color: "#b9cdf0" }}>
          <strong>Race:</strong> {raceName}
        </div>

        <div style={{ color: "#b9cdf0" }}>
          <strong>{classLabel}:</strong> {className}
        </div>

        <div
          style={{
            color: "#b9cdf0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span>
            <strong>{levelLabel}:</strong> {character.level}
          </span>
          <button onClick={onOpenLevelUpWizard} style={{ ...buttonStyle, padding: "6px 10px" }}>
            Level Up
          </button>
        </div>

        <div style={{ color: "#b9cdf0" }}>
          <strong>{hpLabel}:</strong> {character.hp.current}/{character.hp.max}
        </div>
      </div>
    </section>
  );
}