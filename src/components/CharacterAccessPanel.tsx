import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  CampaignAccessRowWithProfile,
  CharacterAccessRole,
  CharacterAccessRowWithProfile,
} from "../lib/cloudRepository";
import { getAccessRowDisplayName, getAccessRowEmail } from "../lib/userDisplay";
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
}

export default function CharacterAccessPanel({
  campaignAccessRows,
  characterAccessRows,
  characterUserCandidateIds,
  getUserLabel,
  onAssignCharacterAccess,
  onUpdateCharacterAccess,
  onRemoveCharacterAccess,
  errorMessage,
  onClearError,
}: CharacterAccessPanelProps) {
  const [busy, setBusy] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccessUserId, setNewAccessUserId] = useState("");
  const [newAccessRole, setNewAccessRole] = useState<CharacterAccessRole>("editor");
  const [accessResult, setAccessResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [removeModalUserId, setRemoveModalUserId] = useState("");

  const explicitAccessUserIds = useMemo(() => new Set(characterAccessRows.map((row) => row.user_id)), [characterAccessRows]);

  const inheritedCampaignEditors = useMemo(
    () => campaignAccessRows.filter((row) => row.role === "editor" && !explicitAccessUserIds.has(row.user_id)),
    [campaignAccessRows, explicitAccessUserIds]
  );

  const addUserIds = useMemo(
    () =>
      characterUserCandidateIds.filter(
        (userId) => !explicitAccessUserIds.has(userId) && !inheritedCampaignEditors.some((row) => row.user_id === userId)
      ),
    [characterUserCandidateIds, explicitAccessUserIds, inheritedCampaignEditors]
  );

  const explicitRows = useMemo(() => {
    return characterAccessRows.map((row) => {
      const displayName = getAccessRowDisplayName(row.profile);
      const email = getAccessRowEmail(row.profile);
      return {
        ...row,
        displayName,
        email,
      };
    });
  }, [characterAccessRows]);

  const inheritedRows = useMemo(() => {
    return inheritedCampaignEditors.map((row) => {
      const displayName = getAccessRowDisplayName(row.profile);
      const email = getAccessRowEmail(row.profile);
      return {
        ...row,
        displayName,
        email,
      };
    });
  }, [inheritedCampaignEditors]);

  async function runAction(action: () => Promise<void>) {
    onClearError();
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function characterAccessLabel(role: CharacterAccessRole) {
    return role === "editor" ? "Can edit" : "Can view";
  }

  function initials(name: string) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return (
    <section style={{ ...panelStyle, display: "grid", gap: 12 }} className="character-access-panel mobile-stack">
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: "0 0 3px", color: "var(--text-primary)", fontSize: 17 }}>Access &amp; Permissions</h3>
          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Manage who can view or edit this character.</div>
        </div>
        <button
          className="button-control" style={primaryButtonStyle}
          disabled={busy}
          onClick={() => {
            setShowAddModal(true);
            setAccessResult(null);
          }}
        >
          + Add Player
        </button>
      </div>

      {/* ── Error / success banners ── */}
      {errorMessage ? (
        <div style={{ border: "1px solid var(--cb-danger-soft-border)", background: "var(--cb-danger-soft)", borderRadius: 10, padding: "12px 12px 12px", color: "var(--cb-danger-text)", fontWeight: 600, fontSize: 13 }}>
          {errorMessage}
        </div>
      ) : null}
      {accessResult ? (
        <div style={{ border: accessResult.type === "success" ? "1px solid var(--cb-success-soft-border)" : "1px solid var(--cb-danger-soft-border)", background: accessResult.type === "success" ? "var(--cb-success-soft)" : "var(--cb-danger-soft)", borderRadius: 10, padding: "12px 12px 12px", color: accessResult.type === "success" ? "var(--cb-success-text)" : "var(--cb-danger-text)", fontWeight: 600, fontSize: 13 }}>
          {accessResult.message}
        </div>
      ) : null}

      {/* ── Unified access list ── */}
      <div className="character-access-list" style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
        <div className="character-access-list-header" style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,2fr) minmax(0,1.4fr) minmax(0,1.4fr) auto", gap: 8, padding: "8px 12px", background: "rgba(16,30,58,0.55)", color: "var(--cb-muted-label)", fontWeight: 700, fontSize: 11.5, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <div>User</div>
          <div>Email</div>
          <div>Permission</div>
          <div>Source</div>
          <div style={{ minWidth: 42 }}></div>
        </div>

        {explicitRows.length === 0 && inheritedRows.length === 0 && (
          <div style={{ padding: "16px", color: "var(--text-secondary)", fontSize: 13 }}>No one has access yet.</div>
        )}

        {explicitRows.map((row) => (
          <div
            key={`direct-${row.user_id}`}
            className="character-access-row mobile-card"
            style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,2fr) minmax(0,1.4fr) minmax(0,1.4fr) auto", gap: 8, alignItems: "center", padding: "12px", borderTop: "1px solid rgba(58,78,127,0.35)", transition: "background 0.12s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(73,224,255,0.04)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--cb-accent-soft-strong)", border: "1.5px solid rgba(73,224,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#9ef5ff", flexShrink: 0 }}>
                {initials(row.displayName)}
              </div>
              <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.displayName}</span>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.email}</div>
            <select
              value={row.role}
              disabled={busy}
              className="form-control"
              style={{ background: "rgba(16,30,58,0.8)", border: "1px solid rgba(73,224,255,0.35)", borderRadius: 8, color: "var(--cb-text)", fontSize: 13, cursor: "pointer" }}
              onChange={(e) => {
                const newRole = e.target.value as CharacterAccessRole;
                void runAction(async () => {
                  await onUpdateCharacterAccess({ userId: row.user_id, role: newRole });
                  setAccessResult({ type: "success", message: `Access changed to ${characterAccessLabel(newRole)}.` });
                });
              }}
            >
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Direct</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button
                title="Remove access"
                className="button-control"
                style={{ ...buttonStyle, color: "#ff8fa8", borderColor: "rgba(255,122,157,0.35)", background: "rgba(255,122,157,0.08)", fontSize: 13 }}
                disabled={busy}
                onClick={() => setRemoveModalUserId(row.user_id)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {inheritedRows.map((row) => (
          <div
            key={`inherited-${row.user_id}`}
            className="character-access-row character-access-row-inherited mobile-card"
            style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,2fr) minmax(0,1.4fr) minmax(0,1.4fr) auto", gap: 8, alignItems: "center", padding: "12px", borderTop: "1px solid rgba(58,78,127,0.35)", opacity: 0.82, transition: "background 0.12s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(138,130,255,0.15)", border: "1.5px solid rgba(138,130,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#c4bfff", flexShrink: 0 }}>
                {initials(row.displayName)}
              </div>
              <span style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.displayName}</span>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.email}</div>
            <div>
              <span style={{ background: "rgba(138,130,255,0.14)", border: "1px solid rgba(138,130,255,0.4)", borderRadius: 8, padding: "3px 8px", fontSize: 12, color: "#c4bfff", fontWeight: 600, whiteSpace: "nowrap" }}>
                Game Master
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                title="This user has access through their campaign role and cannot be removed here."
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "3px 8px", fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, cursor: "default", whiteSpace: "nowrap" }}
              >
                Inherited · Campaign
              </span>
              <span title="Managed at campaign level — cannot be edited here." style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "help", opacity: 0.6 }}>ⓘ</span>
            </div>
            <div style={{ minWidth: 38 }} />
          </div>
        ))}
      </div>

      {showAddModal ? createPortal(
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
          onClick={() => {
            if (busy) return;
            setShowAddModal(false);
          }}
        >
          <div
            style={{ ...panelStyle, width: "min(640px, 96vw)", maxHeight: "calc(100vh - 64px)", overflowY: "auto", border: "1px solid var(--border-bright)", padding: 16, display: "grid", gap: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <strong>Add Player Access</strong>
              <button className="button-control" style={buttonStyle} disabled={busy} onClick={() => setShowAddModal(false)}>
                Close
              </button>
            </div>

            <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
              User
              <select
                value={newAccessUserId}
                onChange={(e) => setNewAccessUserId(e.target.value)}
                className="form-control" style={inputStyle}
                disabled={busy}
              >
                <option value="">Choose user</option>
                {addUserIds.map((userId) => (
                  <option key={userId} value={userId}>
                    {getUserLabel(userId)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
              Access
              <select
                value={newAccessRole}
                onChange={(e) => setNewAccessRole(e.target.value as CharacterAccessRole)}
                className="form-control" style={inputStyle}
                disabled={busy}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                className="button-control" style={primaryButtonStyle}
                disabled={busy || !newAccessUserId}
                onClick={() => {
                  if (!newAccessUserId) return;
                  void runAction(async () => {
                    await onAssignCharacterAccess({ userId: newAccessUserId, role: newAccessRole });
                    setAccessResult({ type: "success", message: "Character access added." });
                    setShowAddModal(false);
                    setNewAccessUserId("");
                    setNewAccessRole("editor");
                  });
                }}
              >
                Add Access
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {removeModalUserId ? createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--cb-modal-overlay)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 70,
          }}
          onClick={() => {
            if (busy) return;
            setRemoveModalUserId("");
          }}
        >
          <div
            style={{ ...panelStyle, width: "min(560px, 96vw)", border: "1px solid var(--border-bright)", padding: 16, display: "grid", gap: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <strong>Remove Character Access</strong>
              <button className="button-control" style={buttonStyle} disabled={busy} onClick={() => setRemoveModalUserId("")}>Close</button>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Remove access for {getUserLabel(removeModalUserId)}?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="button-control" style={buttonStyle} disabled={busy} onClick={() => setRemoveModalUserId("")}>Close</button>
              <button
                className="button-control" style={primaryButtonStyle}
                disabled={busy}
                onClick={() => {
                  void runAction(async () => {
                    await onRemoveCharacterAccess(removeModalUserId);
                    setAccessResult({ type: "success", message: "Character access removed." });
                    setRemoveModalUserId("");
                  });
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </section>
  );
}
