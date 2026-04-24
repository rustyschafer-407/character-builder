import { useMemo, useState } from "react";
import type {
  CampaignAccessRole,
  CampaignAccessRow,
  CharacterAccessRole,
  CharacterAccessRow,
  ProfileRow,
} from "../lib/cloudRepository";
import { buttonStyle, inputStyle, panelStyle, primaryButtonStyle, sectionTitleStyle } from "./uiStyles";

interface AccessManagementPanelProps {
  canManageUsers: boolean;
  canManageCampaignAccess: boolean;
  canManageCharacterAccess: boolean;
  campaignName: string;
  characterName: string | null;
  users: ProfileRow[];
  campaignAccessRows: CampaignAccessRow[];
  characterAccessRows: CharacterAccessRow[];
  campaignUserCandidateIds: string[];
  characterUserCandidateIds: string[];
  getUserLabel: (userId: string) => string;
  onSaveUserRoles: (input: { userId: string; isAdmin: boolean; isGm: boolean }) => Promise<void>;
  onAssignCampaignAccess: (input: { userId: string; role: CampaignAccessRole }) => Promise<void>;
  onUpdateCampaignAccess: (input: { userId: string; role: CampaignAccessRole }) => Promise<void>;
  onRemoveCampaignAccess: (userId: string) => Promise<void>;
  onAssignCharacterAccess: (input: { userId: string; role: CharacterAccessRole }) => Promise<void>;
  onUpdateCharacterAccess: (input: { userId: string; role: CharacterAccessRole }) => Promise<void>;
  onRemoveCharacterAccess: (userId: string) => Promise<void>;
  errorMessage: string;
  onClearError: () => void;
}

export default function AccessManagementPanel({
  canManageUsers,
  canManageCampaignAccess,
  canManageCharacterAccess,
  campaignName,
  characterName,
  users,
  campaignAccessRows,
  characterAccessRows,
  campaignUserCandidateIds,
  characterUserCandidateIds,
  getUserLabel,
  onSaveUserRoles,
  onAssignCampaignAccess,
  onUpdateCampaignAccess,
  onRemoveCampaignAccess,
  onAssignCharacterAccess,
  onUpdateCharacterAccess,
  onRemoveCharacterAccess,
  errorMessage,
  onClearError,
}: AccessManagementPanelProps) {
  const [busy, setBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserIsAdmin, setSelectedUserIsAdmin] = useState(false);
  const [selectedUserIsGm, setSelectedUserIsGm] = useState(false);

  const [campaignAssignUserId, setCampaignAssignUserId] = useState("");
  const [campaignAssignRole, setCampaignAssignRole] = useState<CampaignAccessRole>("player");

  const [characterAssignUserId, setCharacterAssignUserId] = useState("");
  const [characterAssignRole, setCharacterAssignRole] = useState<CharacterAccessRole>("viewer");

  const selectedProfile = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  async function runAction(action: () => Promise<void>) {
    onClearError();
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function onSelectUser(userId: string) {
    setSelectedUserId(userId);
    const user = users.find((item) => item.id === userId) ?? null;
    setSelectedUserIsAdmin(Boolean(user?.is_admin));
    setSelectedUserIsGm(Boolean(user?.is_gm));
  }

  if (!canManageUsers && !canManageCampaignAccess && !canManageCharacterAccess) {
    return null;
  }

  return (
    <section style={{ ...panelStyle, marginBottom: 20, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Access Management</h2>
        {errorMessage ? (
          <button onClick={onClearError} style={buttonStyle}>
            Clear Error
          </button>
        ) : null}
      </div>

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

      {canManageUsers ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Users (Admin)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, alignItems: "end" }}>
            <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
              User
              <select
                value={selectedUserId}
                onChange={(e) => onSelectUser(e.target.value)}
                style={inputStyle}
                disabled={busy}
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {getUserLabel(user.id)}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#b9cdf0", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={selectedUserIsAdmin}
                  onChange={(e) => setSelectedUserIsAdmin(e.target.checked)}
                  disabled={busy || !selectedProfile}
                />
                is_admin
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#b9cdf0", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={selectedUserIsGm}
                  onChange={(e) => setSelectedUserIsGm(e.target.checked)}
                  disabled={busy || !selectedProfile}
                />
                is_gm
              </label>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <button
              style={primaryButtonStyle}
              disabled={busy || !selectedProfile}
              onClick={() => {
                if (!selectedProfile) return;
                void runAction(() =>
                  onSaveUserRoles({
                    userId: selectedProfile.id,
                    isAdmin: selectedUserIsAdmin,
                    isGm: selectedUserIsGm,
                  })
                );
              }}
            >
              Request Role Update
            </button>
            <div style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 12 }}>
              Global role changes are server-only and require trusted credentials.
            </div>
          </div>
        </div>
      ) : null}

      {canManageCampaignAccess ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Campaign Access: {campaignName}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "end" }}>
            <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
              User
              <select
                value={campaignAssignUserId}
                onChange={(e) => setCampaignAssignUserId(e.target.value)}
                style={inputStyle}
                disabled={busy}
              >
                <option value="">Select user</option>
                {campaignUserCandidateIds.map((userId) => (
                  <option key={userId} value={userId}>
                    {getUserLabel(userId)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
              Role
              <select
                value={campaignAssignRole}
                onChange={(e) => setCampaignAssignRole(e.target.value as CampaignAccessRole)}
                style={inputStyle}
                disabled={busy}
              >
                <option value="player">player</option>
                <option value="editor">editor</option>
              </select>
            </label>
            <button
              style={primaryButtonStyle}
              disabled={busy || !campaignAssignUserId}
              onClick={() => {
                if (!campaignAssignUserId) return;
                void runAction(async () => {
                  await onAssignCampaignAccess({ userId: campaignAssignUserId, role: campaignAssignRole });
                });
              }}
            >
              Assign
            </button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {campaignAccessRows.length === 0 ? (
              <div style={{ color: "var(--text-secondary)" }}>No campaign access rows.</div>
            ) : (
              campaignAccessRows.map((row) => (
                <div key={`${row.campaign_id}-${row.user_id}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "center" }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{getUserLabel(row.user_id)}</div>
                  <select
                    value={row.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as CampaignAccessRole;
                      void runAction(() => onUpdateCampaignAccess({ userId: row.user_id, role: nextRole }));
                    }}
                    style={inputStyle}
                    disabled={busy}
                  >
                    <option value="player">player</option>
                    <option value="editor">editor</option>
                  </select>
                  <button
                    style={buttonStyle}
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Remove campaign access for ${getUserLabel(row.user_id)}?`)) return;
                      void runAction(() => onRemoveCampaignAccess(row.user_id));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {canManageCharacterAccess && characterName ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Character Access: {characterName}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "end" }}>
            <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
              User
              <select
                value={characterAssignUserId}
                onChange={(e) => setCharacterAssignUserId(e.target.value)}
                style={inputStyle}
                disabled={busy}
              >
                <option value="">Select user</option>
                {characterUserCandidateIds.map((userId) => (
                  <option key={userId} value={userId}>
                    {getUserLabel(userId)}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
              Role
              <select
                value={characterAssignRole}
                onChange={(e) => setCharacterAssignRole(e.target.value as CharacterAccessRole)}
                style={inputStyle}
                disabled={busy}
              >
                <option value="viewer">viewer</option>
                <option value="editor">editor</option>
              </select>
            </label>
            <button
              style={primaryButtonStyle}
              disabled={busy || !characterAssignUserId}
              onClick={() => {
                if (!characterAssignUserId) return;
                void runAction(async () => {
                  await onAssignCharacterAccess({ userId: characterAssignUserId, role: characterAssignRole });
                });
              }}
            >
              Assign
            </button>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            {characterAccessRows.length === 0 ? (
              <div style={{ color: "var(--text-secondary)" }}>No character access rows.</div>
            ) : (
              characterAccessRows.map((row) => (
                <div key={`${row.character_id}-${row.user_id}`} style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 10, alignItems: "center" }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{getUserLabel(row.user_id)}</div>
                  <select
                    value={row.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as CharacterAccessRole;
                      void runAction(() => onUpdateCharacterAccess({ userId: row.user_id, role: nextRole }));
                    }}
                    style={inputStyle}
                    disabled={busy}
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                  </select>
                  <button
                    style={buttonStyle}
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Remove character access for ${getUserLabel(row.user_id)}?`)) return;
                      void runAction(() => onRemoveCharacterAccess(row.user_id));
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
