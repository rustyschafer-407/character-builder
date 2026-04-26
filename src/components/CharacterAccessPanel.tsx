import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  CampaignAccessRowWithProfile,
  CharacterAccessRole,
  CharacterAccessRowWithProfile,
} from "../lib/cloudRepository";
import { getAccessRowDisplayName } from "../lib/userDisplay";
import { buttonStyle, inputStyle, panelStyle, primaryButtonStyle } from "./uiStyles";

interface CharacterAccessPanelProps {
  characterName: string;
  campaignAccessRows: CampaignAccessRowWithProfile[];
  characterAccessRows: CharacterAccessRowWithProfile[];
  characterUserCandidateIds: string[];
  getUserLabel: (userId: string) => string;
  onAssignCharacterAccess: (input: { userId: string; role: CharacterAccessRole }) => Promise<void>;
  onUpdateCharacterAccess: (input: { userId: string; role: CharacterAccessRole }) => Promise<void>;
  onRemoveCharacterAccess: (userId: string) => Promise<void>;
  errorMessage: string;
  onClearError: () => void;
  openAddPlayerRequestToken?: number;
}

type AccessFeedback = { type: "success" | "error"; message: string } | null;

export default function CharacterAccessPanel({
  characterName,
  campaignAccessRows,
  characterAccessRows,
  characterUserCandidateIds,
  getUserLabel,
  onAssignCharacterAccess,
  onUpdateCharacterAccess,
  onRemoveCharacterAccess,
  errorMessage,
  onClearError,
  openAddPlayerRequestToken = 0,
}: CharacterAccessPanelProps) {
  const [busy, setBusy] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newAccessRole, setNewAccessRole] = useState<CharacterAccessRole>("editor");
  const [result, setResult] = useState<AccessFeedback>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const explicitRows = useMemo(
    () =>
      characterAccessRows.map((row) => ({
        userId: row.user_id,
        role: row.role,
        label: getAccessRowDisplayName(row.profile),
        inherited: false,
      })),
    [characterAccessRows]
  );

  const explicitUserIds = useMemo(
    () => new Set(explicitRows.map((row) => row.userId)),
    [explicitRows]
  );

  const inheritedRows = useMemo(
    () =>
      campaignAccessRows
        .filter((row) => row.role === "editor" && !explicitUserIds.has(row.user_id))
        .map((row) => ({
          userId: row.user_id,
          role: "editor" as CharacterAccessRole,
          label: getAccessRowDisplayName(row.profile),
          inherited: true,
        })),
    [campaignAccessRows, explicitUserIds]
  );

  const chipRows = useMemo(() => [...explicitRows, ...inheritedRows], [explicitRows, inheritedRows]);

  const addCandidateRows = useMemo(
    () =>
      characterUserCandidateIds
        .filter((userId) => !chipRows.some((row) => row.userId === userId))
        .map((userId) => ({ userId, label: getUserLabel(userId) }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    [characterUserCandidateIds, chipRows, getUserLabel]
  );

  const filteredCandidates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return addCandidateRows;
    return addCandidateRows.filter((candidate) => candidate.label.toLowerCase().includes(query));
  }, [addCandidateRows, searchQuery]);

  useEffect(() => {
    if (!showAddModal) return;
    addInputRef.current?.focus();
  }, [showAddModal]);

  useEffect(() => {
    if (openAddPlayerRequestToken <= 0) return;
    setShowAddModal(true);
  }, [openAddPlayerRequestToken]);

  async function runAction(action: () => Promise<void>) {
    onClearError();
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function closeAddModal() {
    if (busy) return;
    setSearchQuery("");
    setNewAccessRole("editor");
    setShowAddModal(false);
  }

  return (
    <section style={{ ...panelStyle, display: "grid", gap: 16 }} className="character-access-panel mobile-stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: 18 }}>Access</h3>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Who can view or edit {characterName}.
          </div>
        </div>
        <button
          className="button-control"
          style={primaryButtonStyle}
          disabled={busy}
          onClick={() => {
            setResult(null);
            setShowAddModal(true);
          }}
        >
          + Add Player
        </button>
      </div>

      {errorMessage ? (
        <div
          style={{
            border: "1px solid var(--cb-danger-soft-border)",
            background: "var(--cb-danger-soft)",
            borderRadius: 12,
            padding: "12px 16px",
            color: "var(--cb-danger-text)",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {result ? (
        <div
          style={{
            border: result.type === "success" ? "1px solid var(--cb-success-soft-border)" : "1px solid var(--cb-danger-soft-border)",
            background: result.type === "success" ? "var(--cb-success-soft)" : "var(--cb-danger-soft)",
            borderRadius: 12,
            padding: "12px 16px",
            color: result.type === "success" ? "var(--cb-success-text)" : "var(--cb-danger-text)",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {result.message}
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {chipRows.length === 0 ? (
          <div
            style={{
              width: "100%",
              border: "1px dashed var(--cb-border)",
              borderRadius: 12,
              padding: "12px 16px",
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            No players assigned.
          </div>
        ) : (
          chipRows.map((row) => (
            <span
              key={`${row.inherited ? "campaign" : "direct"}:${row.userId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minHeight: 36,
                borderRadius: 999,
                border: "1px solid var(--cb-border)",
                background: row.inherited ? "color-mix(in srgb, var(--cb-surface-raised) 82%, transparent)" : "var(--cb-selection-row-bg)",
                color: "var(--cb-text)",
                padding: "0 12px",
                maxWidth: "100%",
              }}
              title={row.inherited ? "Inherited from campaign" : "Direct access"}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                {row.label}
              </span>
              <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>
                {row.role === "editor" ? "Edit" : "View"}
              </span>
              {!row.inherited ? (
                <button
                  type="button"
                  className="button-control button-control--secondary"
                  style={{ ...buttonStyle, minWidth: 28, width: 28, padding: 0, borderRadius: 999 }}
                  disabled={busy}
                  onClick={() => {
                    void runAction(async () => {
                      await onRemoveCharacterAccess(row.userId);
                      setResult({ type: "success", message: "Player removed." });
                    });
                  }}
                  aria-label={`Remove ${row.label}`}
                >
                  ✕
                </button>
              ) : null}
            </span>
          ))
        )}
      </div>

      {explicitRows.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {explicitRows.map((row) => (
            <div
              key={`role:${row.userId}`}
              style={{
                border: "1px solid var(--cb-border)",
                borderRadius: 12,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                background: "color-mix(in srgb, var(--cb-surface-raised) 88%, transparent)",
              }}
            >
              <strong style={{ color: "var(--text-primary)", fontSize: 14 }}>{row.label}</strong>
              <select
                value={row.role}
                disabled={busy}
                className="form-control"
                style={{ ...inputStyle, width: 148, marginTop: 0 }}
                onChange={(event) => {
                  const nextRole = event.target.value as CharacterAccessRole;
                  void runAction(async () => {
                    await onUpdateCharacterAccess({ userId: row.userId, role: nextRole });
                    setResult({ type: "success", message: `Updated ${row.label} to ${nextRole === "editor" ? "edit" : "view"}.` });
                  });
                }}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
            </div>
          ))}
        </div>
      ) : null}

      {showAddModal
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "var(--cb-modal-overlay)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 60,
              }}
              onClick={closeAddModal}
            >
              <div
                style={{
                  ...panelStyle,
                  width: "min(640px, 96vw)",
                  maxHeight: "calc(100vh - 64px)",
                  overflowY: "auto",
                  border: "1px solid var(--border-bright)",
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong>Add Player</strong>
                  <button className="button-control" style={buttonStyle} disabled={busy} onClick={closeAddModal}>
                    Close
                  </button>
                </div>

                <input
                  ref={addInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search players"
                  className="form-control"
                  style={{ ...inputStyle, marginTop: 0 }}
                  disabled={busy}
                />

                <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                  Access
                  <select
                    value={newAccessRole}
                    onChange={(event) => setNewAccessRole(event.target.value as CharacterAccessRole)}
                    className="form-control"
                    style={{ ...inputStyle, marginTop: 8 }}
                    disabled={busy}
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                </label>

                <div style={{ display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                  {filteredCandidates.length === 0 ? (
                    <div
                      style={{
                        border: "1px dashed var(--cb-border)",
                        borderRadius: 12,
                        padding: "12px 16px",
                        color: "var(--text-secondary)",
                        fontSize: 13,
                      }}
                    >
                      No players found.
                    </div>
                  ) : (
                    filteredCandidates.map((candidate) => (
                      <button
                        key={candidate.userId}
                        type="button"
                        className="button-control"
                        style={{
                          ...buttonStyle,
                          justifyContent: "space-between",
                          width: "100%",
                          borderRadius: 12,
                          padding: "0 16px",
                        }}
                        disabled={busy}
                        onClick={() => {
                          void runAction(async () => {
                            await onAssignCharacterAccess({ userId: candidate.userId, role: newAccessRole });
                            setResult({ type: "success", message: `Added ${candidate.label}.` });
                            closeAddModal();
                          });
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {candidate.label}
                        </span>
                        <span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>
                          {newAccessRole === "editor" ? "Edit" : "View"}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                {addCandidateRows.length === 0 ? (
                  <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                    Everyone in this campaign already has access.
                  </div>
                ) : null}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="button-control" style={primaryButtonStyle} disabled={busy} onClick={closeAddModal}>
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
