import { useEffect, useState } from "react";
import type { CharacterRecord } from "../types/character";
import { buttonStyle, inputStyle, labelTextStyle, panelStyle, primaryButtonStyle } from "./uiStyles";
import "./IdentitySection.css";

interface Props {
  character: CharacterRecord;
  campaignName: string;
  raceName: string;
  className: string;
  levelLabel: string;
  hpLabel: string;
  roll20ModPayload: string;
  readOnly?: boolean;
  canEditCharacterType?: boolean;
  editNameRequestToken?: number;
  onNameChange: (name: string) => void;
  onCharacterTypeChange: (characterType: "pc" | "npc") => void;
  onOpenLevelUpWizard: () => void;
}

export default function IdentitySection({
  character,
  campaignName,
  raceName,
  className,
  levelLabel,
  hpLabel,
  roll20ModPayload,
  readOnly = false,
  canEditCharacterType = false,
  editNameRequestToken = 0,
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

  useEffect(() => {
    if (editNameRequestToken <= 0 || readOnly) return;
    startNameEdit();
  }, [editNameRequestToken, readOnly]);

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

  const isTypeEditable = canEditCharacterType && !readOnly;
  const characterType = character.characterType ?? "pc";

  function handleCharacterTypeChange(nextCharacterType: "pc" | "npc") {
    if (!isTypeEditable) {
      if (import.meta.env.DEV) {
        console.warn("[permissions] ignored unauthorized character type change", {
          requestedType: nextCharacterType,
          characterId: character.id,
        });
      }
      return;
    }
    onCharacterTypeChange(nextCharacterType);
  }

  return (
    <section style={{ ...panelStyle, padding: 24 }} className="character-identity-card character-header-card">
      <div className="character-identity-layout">
        <div className="character-identity-main">
          <div>
            {!editingName ? (
              <div className="character-title-row character-name-row">
                <h1 className="character-title character-name">{character.identity.name || "Unnamed Character"}</h1>
                <button
                  onClick={startNameEdit}
                  className="button-control character-name-edit icon-button"
                  style={{
                    ...buttonStyle,
                    width: 32,
                    minWidth: 32,
                    height: 32,
                    minHeight: 32,
                    padding: 0,
                    fontSize: 13,
                    lineHeight: 1,
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
                    className="form-control"
                    style={inputStyle}
                    autoFocus
                    disabled={readOnly}
                  />
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={saveNameEdit}
                    className="button-control"
                    style={{ ...buttonStyle, padding: "6px 10px" }}
                    aria-label="Save name"
                    disabled={readOnly}
                  >
                    ✓
                  </button>
                  <button
                    onClick={cancelNameEdit}
                    className="button-control"
                    style={{ ...buttonStyle, padding: "6px 10px" }}
                    aria-label="Cancel name edit"
                    disabled={readOnly}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {!editingName ? (
              <div className="character-subtitle">
                {className} · {raceName}
              </div>
            ) : null}
          </div>

          <div className="character-chip-row character-meta-row">
            <span className="character-chip character-meta-chip">
              <span className="character-meta-label">{levelLabel}</span>
              <span className="character-meta-value">{character.level}</span>
            </span>
            <span className="character-chip character-meta-chip">
              <span className="character-meta-label">{hpLabel}</span>
              <span className="character-meta-value">
                {character.hp.current}/{character.hp.max}
              </span>
            </span>
            <span className="character-chip character-meta-chip">
              <span className="character-meta-label">Campaign:</span>
              <span className="character-meta-value">{campaignName}</span>
            </span>

            {isTypeEditable ? (
              <label className="character-chip character-meta-chip character-type-chip character-type-chip--editable">
                <span className="character-meta-label">Type:</span>
                <span className="character-meta-value">{characterType.toUpperCase()}</span>
                <span className="character-type-caret" aria-hidden="true">
                  ▾
                </span>
                <select
                  className="character-type-select"
                  value={characterType}
                  onChange={(event) => handleCharacterTypeChange(event.target.value as "pc" | "npc")}
                  disabled={!isTypeEditable}
                  aria-label="Character type"
                >
                  <option value="pc">PC</option>
                  <option value="npc">NPC</option>
                </select>
              </label>
            ) : (
              <span className="character-chip character-meta-chip character-type-chip character-type-chip--readonly">
                <span className="character-meta-label">Type:</span>
                <span className="character-meta-value">{characterType.toUpperCase()}</span>
              </span>
            )}
          </div>

          <div className="character-primary-actions character-actions">
        
          <button
            onClick={copyToRoll20}
            className="button-control character-primary-action btn-primary"
            style={{ ...primaryButtonStyle, padding: "0 16px", minHeight: 40, fontSize: 14, fontWeight: 700 }}
          >
            Copy to Roll20
          </button>
          <button
            onClick={onOpenLevelUpWizard}
            className="button-control character-secondary-action btn-secondary"
            style={{
              ...buttonStyle,
              padding: "0 16px",
              minHeight: 40,
              fontSize: 14,
              fontWeight: 700,
              background: "transparent",
              border: "1px solid var(--cb-border)",
            }}
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