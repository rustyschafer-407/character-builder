import { useMemo, useState } from "react";
import type {
  CampaignAccessRow,
  CharacterAccessRole,
  CharacterAccessRow,
  ProfileRow,
} from "../lib/cloudRepository";
import { resolveUserEmail, resolveUserName } from "../lib/userDisplay";
import { buttonStyle, inputStyle, panelStyle, primaryButtonStyle } from "./uiStyles";

interface CharacterAccessPanelProps {
  characterName: string;
  users: ProfileRow[];
  campaignAccessRows: CampaignAccessRow[];
  characterAccessRows: CharacterAccessRow[];
  characterUserCandidateIds: string[];
  getUserLabel: (userId: string) => string;
  onAssignCharacterAccess: (input: { userId: string; role: CharacterAccessRole }) => Promise<void>;
  onUpdateCharacterAccess: (input: { userId: string; role: CharacterAccessRole }) => Promise<void>;
  onRemoveCharacterAccess: (userId: string) => Promise<void>;
  errorMessage: string;
  onClearError: () => void;
}

export default function CharacterAccessPanel({
  characterName,
  users,
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
  const [changeModalUserId, setChangeModalUserId] = useState("");
  const [changeModalRole, setChangeModalRole] = useState<CharacterAccessRole>("editor");
  const [removeModalUserId, setRemoveModalUserId] = useState("");

  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user] as const)), [users]);
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
      const profile = usersById.get(row.user_id);
      const displayName = resolveUserName(profile, row.user_id);
      const email = resolveUserEmail(profile, row.user_id);
      return {
        ...row,
        displayName,
        email,
      };
    });
  }, [characterAccessRows, usersById]);

  const inheritedRows = useMemo(() => {
    return inheritedCampaignEditors.map((row) => {
      const profile = usersById.get(row.user_id);
      const displayName = resolveUserName(profile, row.user_id);
      const email = resolveUserEmail(profile, row.user_id);
      return {
        ...row,
        displayName,
        email,
      };
    });
  }, [inheritedCampaignEditors, usersById]);

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

  return (
    <section style={{ ...panelStyle, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Character Access</h3>
        <button
          style={buttonStyle}
          disabled={busy}
          onClick={() => {
            setShowAddModal(true);
            setAccessResult(null);
          }}
        >
          Add Player Access
        </button>
      </div>

      <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Choose who can view or edit {characterName}.</div>

      {errorMessage ? (
        <div
          style={{
            border: "1px solid rgba(255, 122, 157, 0.45)",
            background: "rgba(255, 122, 157, 0.14)",
            borderRadius: 10,
            padding: "10px 12px",
            color: "#ffd6e2",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      {accessResult ? (
        <div
          style={{
            border: accessResult.type === "success" ? "1px solid rgba(90, 236, 178, 0.45)" : "1px solid rgba(255, 122, 157, 0.45)",
            background: accessResult.type === "success" ? "rgba(90, 236, 178, 0.14)" : "rgba(255, 122, 157, 0.14)",
            borderRadius: 10,
            padding: "10px 12px",
            color: accessResult.type === "success" ? "#ccffe7" : "#ffd6e2",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {accessResult.message}
        </div>
      ) : null}

      <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr auto", gap: 8, padding: "10px 12px", background: "rgba(16, 30, 58, 0.45)", color: "#b9cdf0", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
          <div>Display Name</div>
          <div>Email</div>
          <div>Access</div>
          <div>Actions</div>
        </div>

        <div style={{ display: "grid", gap: 0 }}>
          {explicitRows.length === 0 ? (
            <div style={{ padding: 12, color: "var(--text-secondary)" }}>No explicit character access rows.</div>
          ) : (
            explicitRows.map((row) => {
              return (
                <div key={`${row.character_id}-${row.user_id}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr auto", gap: 8, alignItems: "center", padding: "10px 12px", borderTop: "1px solid rgba(58, 78, 127, 0.35)" }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{row.displayName}</div>
                  <div style={{ color: "var(--text-secondary)" }}>{row.email}</div>
                  <div style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{characterAccessLabel(row.role)}</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button
                      style={buttonStyle}
                      disabled={busy}
                      onClick={() => {
                        setChangeModalUserId(row.user_id);
                        setChangeModalRole(row.role);
                      }}
                    >
                      Change
                    </button>
                    <button
                      style={buttonStyle}
                      disabled={busy}
                      onClick={() => {
                        setRemoveModalUserId(row.user_id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {inheritedRows.length > 0 ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", background: "rgba(16, 30, 58, 0.45)", color: "#b9cdf0", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
            Inherited Access
          </div>
          <div style={{ display: "grid", gap: 0 }}>
            {inheritedRows.map((row) => (
              <div key={`${row.campaign_id}-${row.user_id}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr auto", gap: 8, alignItems: "center", padding: "10px 12px", borderTop: "1px solid rgba(58, 78, 127, 0.35)" }}>
                <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{row.displayName}</div>
                <div style={{ color: "var(--text-secondary)" }}>{row.email}</div>
                <div style={{ color: "var(--text-secondary)", fontWeight: 600 }}>GM (inherited from campaign)</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, textAlign: "right" }}>Inherited</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(7, 12, 24, 0.65)",
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
            style={{ ...panelStyle, width: "min(640px, 96vw)", border: "1px solid var(--border-bright)", padding: 14, display: "grid", gap: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong>Add Player Access</strong>
              <button style={buttonStyle} disabled={busy} onClick={() => setShowAddModal(false)}>
                Close
              </button>
            </div>

            <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
              User
              <select
                value={newAccessUserId}
                onChange={(e) => setNewAccessUserId(e.target.value)}
                style={inputStyle}
                disabled={busy}
              >
                <option value="">Select user</option>
                {addUserIds.map((userId) => (
                  <option key={userId} value={userId}>
                    {getUserLabel(userId)}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
              Access
              <select
                value={newAccessRole}
                onChange={(e) => setNewAccessRole(e.target.value as CharacterAccessRole)}
                style={inputStyle}
                disabled={busy}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                style={primaryButtonStyle}
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
        </div>
      ) : null}

      {changeModalUserId ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(7, 12, 24, 0.65)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 70,
          }}
          onClick={() => {
            if (busy) return;
            setChangeModalUserId("");
          }}
        >
          <div
            style={{ ...panelStyle, width: "min(560px, 96vw)", border: "1px solid var(--border-bright)", padding: 14, display: "grid", gap: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong>Change Character Access</strong>
              <button style={buttonStyle} disabled={busy} onClick={() => setChangeModalUserId("")}>Close</button>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{getUserLabel(changeModalUserId)}</div>
            <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
              Access
              <select
                value={changeModalRole}
                onChange={(e) => setChangeModalRole(e.target.value as CharacterAccessRole)}
                style={inputStyle}
                disabled={busy}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                style={primaryButtonStyle}
                disabled={busy}
                onClick={() => {
                  void runAction(async () => {
                    await onUpdateCharacterAccess({ userId: changeModalUserId, role: changeModalRole });
                    setAccessResult({ type: "success", message: `Access changed to ${characterAccessLabel(changeModalRole)}.` });
                    setChangeModalUserId("");
                  });
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {removeModalUserId ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(7, 12, 24, 0.65)",
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
            style={{ ...panelStyle, width: "min(560px, 96vw)", border: "1px solid var(--border-bright)", padding: 14, display: "grid", gap: 12 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong>Remove Character Access</strong>
              <button style={buttonStyle} disabled={busy} onClick={() => setRemoveModalUserId("")}>Close</button>
            </div>
            <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Remove access for {getUserLabel(removeModalUserId)}?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={buttonStyle} disabled={busy} onClick={() => setRemoveModalUserId("")}>Close</button>
              <button
                style={primaryButtonStyle}
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
        </div>
      ) : null}
    </section>
  );
}
