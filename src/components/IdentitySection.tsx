import { useState } from "react";
import type { CharacterRecord } from "../types/character";
import { buttonStyle, inputStyle, labelTextStyle, panelStyle, primaryButtonStyle } from "./uiStyles";

interface Props {
  character: CharacterRecord;
  campaignName: string;
  raceName: string;
  classLabel: string;
  className: string;
  levelLabel: string;
  hpLabel: string;
  roll20ModPayload: string;
  readOnly?: boolean;
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
  roll20ModPayload,
  readOnly = false,
  onNameChange,
  onOpenLevelUpWizard,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(character.identity.name);

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

  async function copyToRoll20() {
    try {
      await navigator.clipboard.writeText(roll20ModPayload);
      alert("Roll20 import command copied. Paste directly into Roll20 chat.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left: name + details */}
        <div style={{ flex: 1, display: "grid", gap: 12 }}>
          {!editingName ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
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
              <button
                onClick={startNameEdit}
                style={{ ...buttonStyle, padding: "6px 10px", minWidth: 38 }}
                aria-label="Edit character name"
                title="Edit name"
                disabled={readOnly}
              >
                ✎
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
                  disabled={readOnly}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveNameEdit} style={{ ...buttonStyle, padding: "6px 10px" }} aria-label="Save name" disabled={readOnly}>
                  ✓
                </button>
                <button onClick={cancelNameEdit} style={{ ...buttonStyle, padding: "6px 10px" }} aria-label="Cancel name edit" disabled={readOnly}>
                  ✕
                </button>
              </div>
            </div>
          )}

          <div style={{ color: "#b9cdf0" }}>
            <strong>Campaign:</strong> {campaignName}
          </div>

          <div style={{ color: "#b9cdf0" }}>
            <strong>Race:</strong> {raceName}
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

        {/* Right: action buttons */}
        <div style={{ display: "grid", gap: 8, minWidth: 160 }}>
          <button onClick={copyToRoll20} style={{ ...primaryButtonStyle, padding: "8px 14px" }}>
            Copy to Roll20
          </button>
          <button onClick={onOpenLevelUpWizard} style={{ ...buttonStyle, padding: "8px 14px" }} disabled={readOnly}>
            Level Up
          </button>
        </div>
      </div>
    </section>
  );
}