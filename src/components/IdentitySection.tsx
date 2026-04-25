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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 360px", minWidth: 280, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            {!editingName ? (
              <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    lineHeight: 1.08,
                    color: "var(--text-primary)",
                  }}
                >
                  {character.identity.name || "Unnamed Character"}
                </div>
                <button
                  onClick={startNameEdit}
                  className="button-control"
                  style={{
                    ...buttonStyle,
                    padding: "2px 8px",
                    minWidth: 0,
                    minHeight: 24,
                    fontSize: 13,
                    lineHeight: 1,
                    alignSelf: "baseline",
                  }}
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

            {!editingName ? (
              <div style={{ fontSize: 15, color: "var(--cb-text-muted)", opacity: 0.82 }}>
                {classLabel}: {className} • {raceName}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", color: "var(--cb-text-muted)", fontSize: 13.5, lineHeight: 1.2 }}>
            <span>
              {levelLabel} {character.level}
            </span>
            <span>
              {hpLabel} {character.hp.current}/{character.hp.max}
            </span>
            <span>Campaign: {campaignName}</span>
            <label style={{ ...labelTextStyle, display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
              <span style={{ fontSize: 13.5, color: "var(--cb-text-muted)" }}>Type:</span>
              <select
                className="form-control"
                style={{
                  ...inputStyle,
                  marginTop: 0,
                  width: 88,
                  minWidth: 88,
                  height: 28,
                  padding: "2px 10px",
                  borderRadius: 999,
                  fontSize: 13,
                  lineHeight: 1,
                  background: "var(--cb-surface-raised)",
                  border: "1px solid var(--cb-border)",
                }}
                value={character.characterType ?? "pc"}
                onChange={(event) => onCharacterTypeChange(event.target.value as "pc" | "npc")}
                disabled={readOnly}
                aria-label="Character type"
              >
                <option value="pc">PC</option>
                <option value="npc">NPC</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8, minWidth: 170, alignContent: "start" }}>
          <button onClick={copyToRoll20} className="button-control" style={{ ...primaryButtonStyle, padding: "7px 12px", minHeight: 36, fontSize: 14 }}>
            Copy to Roll20
          </button>
          <button
            onClick={onOpenLevelUpWizard}
            className="button-control"
            style={{ ...buttonStyle, padding: "7px 12px", minHeight: 36, fontSize: 14, background: "transparent", border: "1px solid var(--cb-border)" }}
            disabled={readOnly}
          >
            Level Up
          </button>
        </div>
      </div>
    </section>
  );
}