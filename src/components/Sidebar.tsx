import { useEffect, useState } from "react";
import { getCharacterType } from "../lib/character";
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
}: Props) {
  const [typeFilter, setTypeFilter] = useState<CharacterListTypeFilter>(() => readCharacterTypeFilter());

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
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 700,
    minHeight: 32,
    borderColor: typeFilter === segment ? "var(--accent-primary)" : "var(--cb-border)",
    color: typeFilter === segment ? "var(--text-primary)" : "var(--text-secondary)",
    background: typeFilter === segment ? "var(--cb-accent-soft)" : "var(--cb-button-bg)",
  });

  return (
    <aside
      className="app-sidebar"
      style={{
        ...panelStyle,
        width: 300,
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
            boxShadow: "0 8px 18px var(--cb-accent-soft-strong)",
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

      <div
        role="group"
        aria-label="Character type filter"
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

      <div style={{ marginTop: 24, display: "grid", gap: 8 }}>
        {visibleCharacters.length === 0 && <p style={{ margin: 0, ...mutedTextStyle }}>No characters yet.</p>}

        {visibleCharacters.map((c) => {
          const isSelected = c.id === selectedId;
          const displayName = c.identity.name?.trim() || "Unnamed Character";
          const canDelete = canDeleteCharacter(c.id);
          const characterType = getCharacterType(c);
          const isNpc = characterType === "npc";

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
                  background: isSelected ? "var(--cb-accent-soft)" : "rgba(11, 22, 42, 0.75)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ display: "block", color: "var(--text-primary)" }}>{displayName}</strong>
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 999,
                      border: "1px solid var(--cb-border)",
                      color: isNpc ? "var(--cb-warning-text)" : "var(--cb-success-text)",
                      background: isNpc ? "var(--cb-warning-soft)" : "var(--cb-success-soft)",
                    }}
                  >
                    {characterType.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {getCampaignName(c.campaignId)} • {getClassName(c.classId)}
                </div>
              </button>

              <button
                onClick={() => onDelete(c.id)}
                style={{
                  ...dangerButtonStyle,
                  opacity: canDelete ? 1 : 0.45,
                  cursor: canDelete ? "pointer" : "not-allowed",
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