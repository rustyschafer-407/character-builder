import { useEffect, useState } from "react";
import { getCharacterType } from "../lib/character";
import * as Permissions from "../lib/permissions";
import type { AuthState } from "../lib/permissions";
import type { CharacterRecord } from "../types/character";
import {
  buttonStyle,
  dangerButtonStyle,
  mutedTextStyle,
  panelStyle,
  primaryButtonStyle,
} from "./uiStyles";

type CharacterListTypeFilter = "all" | "pc" | "npc";

const characterTypeFilterStorageKey = "character-builder.characterListTypeFilter";

function readCharacterTypeFilter(): CharacterListTypeFilter {
  if (typeof window === "undefined") return "all";
  try {
    const rawValue = (window.localStorage.getItem(characterTypeFilterStorageKey) ?? "").toLowerCase();
    if (rawValue === "pc" || rawValue === "npc") return rawValue;
    return "all";
  } catch {
    return "all";
  }
}

interface Props {
  characters: CharacterRecord[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  canCreate: boolean;
  canDeleteCharacter: (id: string) => boolean;
  getCampaignName: (campaignId: string) => string;
  getClassName: (classId: string) => string;
  authState: AuthState;
}

export default function Sidebar({
  characters,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  canCreate,
  canDeleteCharacter,
  getCampaignName,
  getClassName,
  authState,
}: Props) {
  const [typeFilter, setTypeFilter] = useState<CharacterListTypeFilter>(() => readCharacterTypeFilter());
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null);

  // Determine if NPC controls should be shown
  const showNpcControls = Permissions.shouldShowNpcControls(authState);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(characterTypeFilterStorageKey, typeFilter);
    } catch {
      // Ignore storage write errors so filtering still works for this session.
    }
  }, [typeFilter]);

  const visibleCharacters = characters
    .filter((character) => {
      // Hide NPCs from players
      if (!showNpcControls && getCharacterType(character) === "npc") {
        return false;
      }
      if (typeFilter === "all") return true;
      return getCharacterType(character) === typeFilter;
    })
    .sort((a, b) => {
    const aName = a.identity.name?.trim() || "Unnamed Character";
    const bName = b.identity.name?.trim() || "Unnamed Character";
    return aName.localeCompare(bName, undefined, { sensitivity: "base" });
  });

  const segmentButtonStyle = (segment: CharacterListTypeFilter) => ({
    ...buttonStyle,
    flex: 1,
    justifyContent: "center" as const,
    padding: "0 12px",
    fontSize: 12,
    fontWeight: 700,
    minHeight: 34,
    borderColor: typeFilter === segment ? "var(--accent-primary)" : "rgba(255,255,255,0.1)",
    color: typeFilter === segment ? "var(--text-primary)" : "var(--text-secondary)",
    background:
      typeFilter === segment
        ? "linear-gradient(140deg, var(--cb-accent-soft), var(--cb-accent-soft-strong))"
        : "rgba(8, 16, 31, 0.66)",
    boxShadow: typeFilter === segment ? "0 0 0 1px var(--cb-accent-soft-strong), 0 6px 14px rgba(0, 0, 0, 0.2)" : "none",
    transition: "all 180ms ease",
  });

  return (
    <aside
      className="app-sidebar mobile-stack"
      style={{
        ...panelStyle,
        width: 300,
        gap: 0,
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16, color: "var(--text-primary)" }}>Characters</h2>

      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={onCreate}
          disabled={!canCreate}
          style={{
            ...primaryButtonStyle,
            flex: 1,
            justifyContent: "center",
            padding: "12px 14px",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: "0.01em",
            boxShadow: "0 6px 14px var(--cb-accent-soft)",
            opacity: canCreate ? 1 : 0.55,
            cursor: canCreate ? "pointer" : "not-allowed",
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

      {showNpcControls ? (
        <div
          role="group"
          aria-label="Character type filter"
          className="sidebar-type-filter"
          style={{ display: "flex", gap: 6, marginTop: 10 }}
        >
          <button className="button-control" type="button" onClick={() => setTypeFilter("all")} style={segmentButtonStyle("all")}>
            All
          </button>
          <button className="button-control" type="button" onClick={() => setTypeFilter("pc")} style={segmentButtonStyle("pc")}>
            PCs
          </button>
          <button className="button-control" type="button" onClick={() => setTypeFilter("npc")} style={segmentButtonStyle("npc")}>
            NPCs
          </button>
        </div>
      ) : null}

      <div className="sidebar-character-list" style={{ marginTop: 18, display: "grid", gap: 8 }}>
        {visibleCharacters.length === 0 && <p style={{ margin: 0, ...mutedTextStyle }}>No characters yet.</p>}

        {visibleCharacters.map((c) => {
          const isSelected = c.id === selectedId;
          const displayName = c.identity.name?.trim() || "Unnamed Character";
          const canDelete = canDeleteCharacter(c.id);
          const characterType = getCharacterType(c);
          const isNpc = characterType === "npc";
          const deleteHovered = hoveredDeleteId === c.id;

          return (
            <div
              key={c.id}
              className="sidebar-character-card mobile-card"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 40px",
                alignItems: "center",
                gap: 12,
                padding: "13px 14px",
                borderRadius: 12,
                border: isSelected ? "1px solid var(--cb-accent)" : "1px solid var(--cb-border)",
                background: isSelected ? "var(--cb-accent-soft)" : "var(--cb-surface-raised)",
                boxShadow: isSelected ? "inset 0 0 0 1px var(--cb-accent-soft-strong)" : "none",
                transition: "background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
              }}
            >
              <button
                onClick={() => onSelect(c.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  minWidth: 0,
                  textAlign: "left",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  boxShadow: "none",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  transition: "opacity 180ms ease, color 180ms ease",
                  transform: "none",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontWeight: 750,
                    lineHeight: 1.25,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {displayName}
                </strong>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.25,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {getCampaignName(c.campaignId)} • {getClassName(c.classId)}
                </div>
              </button>

              {showNpcControls ? (
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    minWidth: 46,
                    textAlign: "center",
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: isNpc ? "1px solid var(--cb-warning-soft-border)" : "1px solid var(--cb-accent)",
                    color: isNpc ? "var(--cb-warning-text)" : "var(--cb-accent)",
                    background: isNpc ? "var(--cb-warning-soft)" : "var(--cb-accent-soft)",
                    opacity: 1,
                    justifySelf: "center",
                  }}
                >
                  {characterType.toUpperCase()}
                </span>
              ) : (
                <span />
              )}

              <button
                onClick={() => onDelete(c.id)}
                onMouseEnter={() => setHoveredDeleteId(c.id)}
                onMouseLeave={() => setHoveredDeleteId(null)}
                style={{
                  ...dangerButtonStyle,
                  width: 36,
                  minWidth: 36,
                  height: 36,
                  minHeight: 36,
                  padding: 0,
                  justifySelf: "center",
                  alignSelf: "center",
                  border: "1px solid var(--cb-button-danger-border)",
                  background: "var(--cb-button-danger-bg)",
                  color: "var(--cb-button-danger-text)",
                  opacity: canDelete ? (deleteHovered ? 1 : 0.82) : 0.45,
                  cursor: canDelete ? "pointer" : "not-allowed",
                  boxShadow: deleteHovered ? "0 6px 14px var(--cb-focus-shadow)" : "none",
                  transition: "all 180ms ease",
                }}
                disabled={!canDelete}
                title={canDelete ? "Delete character" : "You do not have permission to delete this character"}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}