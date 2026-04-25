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

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px",
    borderRadius: 20,
    background: "rgba(138, 180, 248, 0.12)",
    border: "1px solid rgba(138, 180, 248, 0.24)",
    color: "var(--text-primary)",
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  const pillLabelStyle: React.CSSProperties = {
    color: "var(--cb-text-muted)",
    fontSize: 12,
    fontWeight: 600,
    opacity: 0.85,
  };

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexDirection: "column" }}>
        {/* Name + edit */}
        <div style={{ width: "100%" }}>
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
        </div>

        {/* Details in pill badges */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={pillStyle}>
            <span style={pillLabelStyle}>RACE</span>
            <span>{raceName}</span>
          </div>
          <div style={pillStyle}>
            <span style={pillLabelStyle}>{classLabel}</span>
            <span>{className}</span>
          </div>
          <div style={pillStyle}>
            <span style={pillLabelStyle}>{levelLabel}</span>
            <span>{character.level}</span>
          </div>
          <div style={pillStyle}>
            <span style={pillLabelStyle}>{hpLabel}</span>
            <span>{character.hp.current}/{character.hp.max}</span>
          </div>
        </div>

        {/* Campaign info + controls row */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "var(--cb-text-muted)", fontSize: 13 }}>
              <strong style={{ color: "var(--cb-muted-label)", fontWeight: 600 }}>Campaign:</strong> {campaignName}
            </span>
            <label style={{ ...labelTextStyle, display: "flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
              <span style={{ minWidth: 100 }}>Character Type</span>
              <select
                className="form-control"
                style={{ ...inputStyle, marginTop: 0, width: 110, minWidth: 110 }}
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
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyToRoll20} className="button-control" style={{ ...primaryButtonStyle, padding: "8px 14px", minHeight: 38 }}>
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
      </div>
    </section>
  );
}