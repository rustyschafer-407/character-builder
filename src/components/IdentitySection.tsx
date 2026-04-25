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
  onCharacterTypeChange: (characterType: "pc" | "npc") => void;
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
  onCharacterTypeChange,
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
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Left: name + details */}
        <div style={{ flex: 1, display: "grid", gap: 10 }}>
          {!editingName ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  lineHeight: 1.02,
                  color: "var(--text-primary)",
                }}
              >
                {character.identity.name || "Unnamed Character"}
              </div>
              <button
                onClick={startNameEdit}
                className="button-control"
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
                  placeholder="Character name"
                  className="form-control" style={inputStyle}
                  autoFocus
                  disabled={readOnly}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveNameEdit} className="button-control" style={{ ...buttonStyle, padding: "6px 10px" }} aria-label="Save name" disabled={readOnly}>
                  ✓
                </button>
                <button onClick={cancelNameEdit} className="button-control" style={{ ...buttonStyle, padding: "6px 10px" }} aria-label="Cancel name edit" disabled={readOnly}>
                  ✕
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 4, marginTop: 2 }}>
            <div style={{ color: "var(--cb-text-muted)", fontSize: 13, lineHeight: 1.35 }}>
              <strong style={{ color: "var(--cb-muted-label)", fontWeight: 600 }}>Campaign:</strong> {campaignName}
            </div>
            <div style={{ color: "var(--cb-text-muted)", fontSize: 13, lineHeight: 1.35 }}>
              <strong style={{ color: "var(--cb-muted-label)", fontWeight: 600 }}>Race:</strong> {raceName}
            </div>
            <div style={{ color: "var(--cb-text-muted)", fontSize: 13, lineHeight: 1.35 }}>
              <strong style={{ color: "var(--cb-muted-label)", fontWeight: 600 }}>{classLabel}:</strong> {className}
            </div>
            <div style={{ color: "var(--cb-text-muted)", fontSize: 13, lineHeight: 1.35 }}>
              <strong style={{ color: "var(--cb-muted-label)", fontWeight: 600 }}>{levelLabel}:</strong> {character.level}
            </div>
            <div style={{ color: "var(--cb-text-muted)", fontSize: 13, lineHeight: 1.35 }}>
              <strong style={{ color: "var(--cb-muted-label)", fontWeight: 600 }}>{hpLabel}:</strong> {character.hp.current}/{character.hp.max}
            </div>
          </div>

          <label style={{ ...labelTextStyle, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ minWidth: 102 }}>Character Type</span>
            <select
              className="form-control"
              style={{ ...inputStyle, marginTop: 0, width: 120, minWidth: 120 }}
              value={character.characterType ?? "pc"}
              onChange={(event) => onCharacterTypeChange(event.target.value as "pc" | "npc")}
              disabled={readOnly}
            >
              <option value="pc">PC</option>
              <option value="npc">NPC</option>
            </select>
          </label>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: "grid", gap: 8, minWidth: 160 }}>
          <button data-guide="export-roll20" onClick={copyToRoll20} className="button-control" style={{ ...primaryButtonStyle, padding: "8px 14px", minHeight: 38 }}>
            Copy to Roll20
          </button>
          <button
            onClick={onOpenLevelUpWizard}
            className="button-control"
            style={{ ...buttonStyle, padding: "8px 14px", minHeight: 38, background: "transparent", border: "1px solid var(--cb-border)" }}
            disabled={readOnly}
          >
            Level Up
          </button>
        </div>
      </div>
    </section>
  );
}