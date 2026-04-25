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
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                width: "fit-content",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid var(--border-soft)",
                background: "linear-gradient(180deg, rgba(10, 24, 45, 0.82), rgba(7, 16, 33, 0.82))",
                boxShadow: "0 0 0 1px rgba(73, 224, 255, 0.08), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(38px, 5vw, 58px)",
                  fontWeight: 800,
                  lineHeight: 1.05,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.02em",
                }}
              >
                {character.identity.name || "Unnamed Character"}
              </div>
              <button
                onClick={startNameEdit}
                style={{
                  ...buttonStyle,
                  width: 44,
                  height: 44,
                  minWidth: 44,
                  padding: 0,
                  borderRadius: 10,
                  border: "1px solid rgba(73, 224, 255, 0.45)",
                  background: "rgba(6, 19, 39, 0.7)",
                  color: "#9feefe",
                  fontSize: 18,
                }}
                aria-label="Edit character name"
                title="Edit name"
                disabled={readOnly}
              >
                ✏
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 8,
                width: "min(520px, 100%)",
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid var(--border-soft)",
                background: "linear-gradient(180deg, rgba(10, 24, 45, 0.82), rgba(7, 16, 33, 0.82))",
              }}
            >
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