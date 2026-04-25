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
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null);

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
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 700,
    minHeight: 30,
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

      <div style={{ marginTop: 18, display: "grid", gap: 6 }}>
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
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: isSelected ? "1px solid var(--cb-accent)" : "1px solid var(--border-soft)",
                  background: isSelected ? "rgba(16, 30, 58, 0.86)" : "rgba(11, 22, 42, 0.72)",
                  boxShadow: isSelected ? "inset 0 0 0 1px var(--cb-accent-soft-strong), 0 4px 14px rgba(0, 0, 0, 0.22)" : "none",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  transition: "all 180ms ease",
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
                      minWidth: 34,
                      textAlign: "center",
                      padding: "2px 6px",
                      borderRadius: 999,
                      border: isNpc ? "1px solid rgba(255, 188, 83, 0.34)" : "1px solid rgba(73, 224, 255, 0.3)",
                      color: isNpc ? "#f1d3a1" : "#a9e8f5",
                      background: isNpc ? "rgba(239, 170, 87, 0.14)" : "rgba(73, 224, 255, 0.12)",
                      opacity: 0.88,
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
                onMouseEnter={() => setHoveredDeleteId(c.id)}
                onMouseLeave={() => setHoveredDeleteId(null)}
                style={{
                  ...dangerButtonStyle,
                  border: hoveredDeleteId === c.id ? "1px solid var(--cb-button-danger-border)" : "1px solid rgba(255, 122, 157, 0.24)",
                  background: hoveredDeleteId === c.id ? "var(--cb-button-danger-bg)" : "rgba(255, 122, 157, 0.08)",
                  color: hoveredDeleteId === c.id ? "var(--cb-button-danger-text)" : "rgba(255, 214, 226, 0.68)",
                  opacity: canDelete ? (hoveredDeleteId === c.id ? 1 : 0.56) : 0.4,
                  cursor: canDelete ? "pointer" : "not-allowed",
                  boxShadow: hoveredDeleteId === c.id ? "0 6px 14px rgba(0, 0, 0, 0.2)" : "none",
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