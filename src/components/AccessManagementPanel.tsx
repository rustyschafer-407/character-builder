import { useEffect, useMemo, useState } from "react";
import type {
  CampaignAccessRole,
  CampaignAccessRow,
  CharacterAccessRole,
  CharacterAccessRow,
  ProfileRow,
} from "../lib/cloudRepository";
import { getSupabaseClient } from "../lib/supabaseClient";
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
  onDeleteUser: (input: { userId: string }) => Promise<void>;
  onCreatePlayer: (input: {
    displayName: string;
    email: string;
    temporaryPassword: string;
    isAdmin: boolean;
    isGm: boolean;
  }) => Promise<{ ok: boolean; message: string }>;
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
  onDeleteUser,
  onCreatePlayer,
  onAssignCampaignAccess,
  onUpdateCampaignAccess,
  onRemoveCampaignAccess,
  onAssignCharacterAccess,
  onUpdateCharacterAccess,
  onRemoveCharacterAccess,
  errorMessage,
  onClearError,
}: AccessManagementPanelProps) {
  type Workflow = "people" | "campaign-members" | "character-access";

  const [busy, setBusy] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow>("people");

  const [editUserId, setEditUserId] = useState("");
  const [editUserIsAdmin, setEditUserIsAdmin] = useState(false);
  const [editUserIsGm, setEditUserIsGm] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showSetPasswordPanel, setShowSetPasswordPanel] = useState(false);
  const [showCreatePlayerPanel, setShowCreatePlayerPanel] = useState(false);
  const [createPlayerDisplayName, setCreatePlayerDisplayName] = useState("");
  const [createPlayerEmail, setCreatePlayerEmail] = useState("");
  const [createPlayerTemporaryPassword, setCreatePlayerTemporaryPassword] = useState("");
  const [createPlayerIsGm, setCreatePlayerIsGm] = useState(false);
  const [createPlayerIsAdmin, setCreatePlayerIsAdmin] = useState(false);
  const [createPlayerResult, setCreatePlayerResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showCampaignAddPanel, setShowCampaignAddPanel] = useState(false);
  const [campaignUserSearch, setCampaignUserSearch] = useState("");
  const [campaignMemberResult, setCampaignMemberResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [campaignRoleModalUserId, setCampaignRoleModalUserId] = useState("");
  const [campaignRoleModalValue, setCampaignRoleModalValue] = useState<CampaignAccessRole>("player");
  const [campaignRemoveModalUserId, setCampaignRemoveModalUserId] = useState("");

  const [campaignAssignUserId, setCampaignAssignUserId] = useState("");
  const [campaignAssignRole, setCampaignAssignRole] = useState<CampaignAccessRole>("player");

  const [characterAssignUserId, setCharacterAssignUserId] = useState("");
  const [characterAssignRole, setCharacterAssignRole] = useState<CharacterAccessRole>("editor");

  const [setPasswordNewPassword, setSetPasswordNewPassword] = useState("");
  const [setPasswordConfirmPassword, setSetPasswordConfirmPassword] = useState("");
  const [setPasswordResult, setSetPasswordResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const workflowOptions = useMemo(() => {
    const options: Array<{ id: Workflow; label: string }> = [];
    if (canManageUsers) options.push({ id: "people", label: "People" });
    if (canManageCampaignAccess) options.push({ id: "campaign-members", label: "Campaign Members" });
    return options;
  }, [canManageUsers, canManageCampaignAccess]);

  const selectedEditUser = useMemo(
    () => users.find((user) => user.id === editUserId) ?? null,
    [editUserId, users]
  );

  const characterViewerInUse = useMemo(
    () => characterAccessRows.some((row) => row.role === "viewer"),
    [characterAccessRows]
  );

  const characterRoleOptions: CharacterAccessRole[] = characterViewerInUse ? ["viewer", "editor"] : ["editor"];
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user] as const)),
    [users]
  );
  const campaignEditorCount = useMemo(
    () => campaignAccessRows.filter((row) => row.role === "editor").length,
    [campaignAccessRows]
  );
  const assignedCampaignUserIds = useMemo(
    () => new Set(campaignAccessRows.map((row) => row.user_id)),
    [campaignAccessRows]
  );
  const filteredCampaignCandidateIds = useMemo(() => {
    const query = campaignUserSearch.trim().toLowerCase();
    return campaignUserCandidateIds.filter((userId) => {
      if (assignedCampaignUserIds.has(userId)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const profile = usersById.get(userId);
      const displayName = profile?.display_name?.toLowerCase() ?? "";
      const email = profile?.email?.toLowerCase() ?? "";
      return displayName.includes(query) || email.includes(query) || userId.toLowerCase().includes(query);
    });
  }, [campaignUserCandidateIds, campaignUserSearch, assignedCampaignUserIds, usersById]);

  useEffect(() => {
    if (workflowOptions.length === 0) {
      return;
    }
    const valid = workflowOptions.some((option) => option.id === activeWorkflow);
    if (!valid) {
      setActiveWorkflow(workflowOptions[0].id);
    }
  }, [activeWorkflow, workflowOptions]);

  async function runAction(action: () => Promise<void>) {
    onClearError();
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  function resetCreatePlayerForm() {
    setCreatePlayerDisplayName("");
    setCreatePlayerEmail("");
    setCreatePlayerTemporaryPassword("");
    setCreatePlayerIsGm(false);
    setCreatePlayerIsAdmin(false);
  }

  function openEditUser(user: ProfileRow) {
    setEditUserId(user.id);
    setEditUserIsAdmin(Boolean(user.is_admin));
    setEditUserIsGm(Boolean(user.is_gm));
    setShowEditPanel(true);
    setShowSetPasswordPanel(false);
    setShowCreatePlayerPanel(false);
  }

  function roleBadges(user: ProfileRow) {
    const badges: string[] = [];
    if (user.is_admin) badges.push("Admin");
    if (user.is_gm) badges.push("GM");
    if (badges.length === 0) badges.push("Player");
    return badges;
  }

  function characterRoleLabel(role: CharacterAccessRole) {
    return role === "editor" ? "Can edit" : "Can view";
  }

  function campaignRoleLabel(role: CampaignAccessRole) {
    return role === "editor" ? "GM / Editor" : "Player";
  }

  function resetSetPasswordForm() {
    setSetPasswordNewPassword("");
    setSetPasswordConfirmPassword("");
    setSetPasswordResult(null);
  }

  async function handleSetPassword() {
    if (!selectedEditUser) return;

    const newPwd = setPasswordNewPassword.trim();
    const confirmPwd = setPasswordConfirmPassword.trim();

    if (!newPwd || !confirmPwd) {
      setSetPasswordResult({ type: "error", message: "Both password fields are required." });
      return;
    }

    if (newPwd !== confirmPwd) {
      setSetPasswordResult({ type: "error", message: "Passwords do not match." });
      return;
    }

    void runAction(async () => {
      try {
        const supabase = getSupabaseClient();
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) {
          setSetPasswordResult({ type: "error", message: "Failed to get session token. Please refresh and try again." });
          return;
        }

        const response = await fetch("/api/admin-set-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            userId: selectedEditUser.id,
            newPassword: newPwd,
          }),
        });

        const data = (await response.json()) as { message?: string; error?: string };

        if (!response.ok) {
          setSetPasswordResult({ type: "error", message: data.error || "Failed to set password." });
          return;
        }

        setSetPasswordResult({ type: "success", message: data.message || "Password updated successfully." });
        resetSetPasswordForm();
      } catch (err) {
        const message = err instanceof Error ? err.message : "An unexpected error occurred.";
        setSetPasswordResult({ type: "error", message });
      }
    });
  }

  if (!canManageUsers && !canManageCampaignAccess && !canManageCharacterAccess) {
    return null;
  }

  return (
    <section style={{ ...panelStyle, marginBottom: 20, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Permissions</h2>
        {errorMessage ? (
          <button onClick={onClearError} style={buttonStyle}>
            Clear Message
          </button>
        ) : null}
      </div>

      <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
        Manage people, campaign members, and account permissions.
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

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {workflowOptions.map((option) => {
          const active = activeWorkflow === option.id;
          return (
            <button
              key={option.id}
              style={active ? primaryButtonStyle : buttonStyle}
              onClick={() => setActiveWorkflow(option.id)}
              disabled={busy}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {activeWorkflow === "people" && canManageUsers ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>People</h3>
            <button
              style={primaryButtonStyle}
              disabled={busy}
              onClick={() => {
                setShowCreatePlayerPanel((current) => !current);
                setShowEditPanel(false);
                setShowSetPasswordPanel(false);
                setCreatePlayerResult(null);
              }}
            >
              Add Player
            </button>
          </div>

          <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.8fr 1fr auto", gap: 8, padding: "10px 12px", background: "rgba(16, 30, 58, 0.45)", color: "#b9cdf0", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
              <div>Name</div>
              <div>Email</div>
              <div>Roles</div>
              <div>Actions</div>
            </div>
            <div style={{ display: "grid", gap: 0 }}>
              {users.length === 0 ? (
                <div style={{ padding: 12, color: "var(--text-secondary)" }}>No users found.</div>
              ) : (
                users.map((user) => (
                  <div key={user.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.8fr 1fr auto", gap: 8, alignItems: "center", padding: "10px 12px", borderTop: "1px solid rgba(58, 78, 127, 0.35)" }}>
                    <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {user.display_name?.trim() || user.email || "Unknown user"}
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>{user.email || "No email"}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {roleBadges(user).map((badge) => (
                        <span
                          key={`${user.id}-${badge}`}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid #3a4e7f",
                            background: "rgba(11, 22, 42, 0.72)",
                            color: "#d7e8ff",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button style={buttonStyle} disabled={busy} onClick={() => openEditUser(user)}>
                        Edit
                      </button>
                      <button
                        style={buttonStyle}
                        disabled={busy}
                        onClick={() => {
                          setEditUserId(user.id);
                          setShowSetPasswordPanel(true);
                          setShowEditPanel(false);
                          setShowCreatePlayerPanel(false);
                        }}
                      >
                        Set Password
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {showCreatePlayerPanel ? (
            <div style={{ ...panelStyle, border: "1px solid var(--border-bright)", padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <strong>Add Player</strong>
                <button style={buttonStyle} onClick={() => setShowCreatePlayerPanel(false)} disabled={busy}>
                  Close
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                  Display Name
                  <input
                    type="text"
                    value={createPlayerDisplayName}
                    onChange={(e) => setCreatePlayerDisplayName(e.target.value)}
                    style={inputStyle}
                    disabled={busy}
                  />
                </label>
                <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                  Email
                  <input
                    type="email"
                    value={createPlayerEmail}
                    onChange={(e) => setCreatePlayerEmail(e.target.value)}
                    style={inputStyle}
                    disabled={busy}
                  />
                </label>
              </div>
              <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                Temporary Password
                <input
                  type="password"
                  value={createPlayerTemporaryPassword}
                  onChange={(e) => setCreatePlayerTemporaryPassword(e.target.value)}
                  style={inputStyle}
                  disabled={busy}
                />
              </label>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#b9cdf0", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={createPlayerIsGm}
                    onChange={(e) => setCreatePlayerIsGm(e.target.checked)}
                    disabled={busy}
                  />
                  Can create campaigns
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#b9cdf0", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={createPlayerIsAdmin}
                    onChange={(e) => setCreatePlayerIsAdmin(e.target.checked)}
                    disabled={busy}
                  />
                  Admin
                </label>
              </div>
              {createPlayerResult ? (
                <div
                  style={{
                    border: createPlayerResult.type === "success" ? "1px solid rgba(90, 236, 178, 0.45)" : "1px solid rgba(255, 122, 157, 0.45)",
                    background: createPlayerResult.type === "success" ? "rgba(90, 236, 178, 0.14)" : "rgba(255, 122, 157, 0.14)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: createPlayerResult.type === "success" ? "#ccffe7" : "#ffd6e2",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {createPlayerResult.message}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  style={primaryButtonStyle}
                  disabled={busy || !createPlayerDisplayName.trim() || !createPlayerEmail.trim() || createPlayerTemporaryPassword.length < 8}
                  onClick={() => {
                    void runAction(async () => {
                      const result = await onCreatePlayer({
                        displayName: createPlayerDisplayName.trim(),
                        email: createPlayerEmail.trim(),
                        temporaryPassword: createPlayerTemporaryPassword,
                        isAdmin: createPlayerIsAdmin,
                        isGm: createPlayerIsGm,
                      });

                      if (result.ok) {
                        setCreatePlayerResult({ type: "success", message: result.message });
                        resetCreatePlayerForm();
                        return;
                      }

                      setCreatePlayerResult({ type: "error", message: result.message });
                    });
                  }}
                >
                  Create Player
                </button>
                <button
                  style={buttonStyle}
                  disabled={busy}
                  onClick={() => {
                    resetCreatePlayerForm();
                    setCreatePlayerResult(null);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}

          {showEditPanel && selectedEditUser ? (
            <div style={{ ...panelStyle, border: "1px solid var(--border-bright)", padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <strong>Edit User Roles</strong>
                <button style={buttonStyle} onClick={() => setShowEditPanel(false)} disabled={busy}>
                  Close
                </button>
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{selectedEditUser.email || selectedEditUser.id}</div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#b9cdf0", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={editUserIsAdmin}
                    onChange={(e) => setEditUserIsAdmin(e.target.checked)}
                    disabled={busy}
                  />
                  Admin
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#b9cdf0", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={editUserIsGm}
                    onChange={(e) => setEditUserIsGm(e.target.checked)}
                    disabled={busy}
                  />
                  GM
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  style={primaryButtonStyle}
                  disabled={busy}
                  onClick={() => {
                    if (!selectedEditUser) return;
                    void runAction(async () => {
                      await onSaveUserRoles({
                        userId: selectedEditUser.id,
                        isAdmin: editUserIsAdmin,
                        isGm: editUserIsGm,
                      });
                      setShowEditPanel(false);
                    });
                  }}
                >
                  Save
                </button>
                <button style={buttonStyle} disabled={busy} onClick={() => setShowEditPanel(false)}>
                  Cancel
                </button>
                <button
                  style={buttonStyle}
                  disabled={busy}
                  onClick={() => {
                    if (!selectedEditUser) return;
                    if (!window.confirm(`Delete user ${getUserLabel(selectedEditUser.id)}? This removes their login and cannot be undone.`)) {
                      return;
                    }
                    void runAction(async () => {
                      await onDeleteUser({ userId: selectedEditUser.id });
                      setShowEditPanel(false);
                    });
                  }}
                >
                  Delete User
                </button>
              </div>
            </div>
          ) : null}

          {showSetPasswordPanel && selectedEditUser ? (
            <div style={{ ...panelStyle, border: "1px solid var(--border-bright)", padding: 12, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <strong>Set Password</strong>
                <button style={buttonStyle} onClick={() => setShowSetPasswordPanel(false)} disabled={busy}>
                  Close
                </button>
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                User: {selectedEditUser.email || selectedEditUser.id}
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                  New Password
                  <input
                    type="password"
                    value={setPasswordNewPassword}
                    onChange={(e) => setSetPasswordNewPassword(e.target.value)}
                    style={inputStyle}
                    disabled={busy}
                  />
                </label>
                <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                  Confirm Password
                  <input
                    type="password"
                    value={setPasswordConfirmPassword}
                    onChange={(e) => setSetPasswordConfirmPassword(e.target.value)}
                    style={inputStyle}
                    disabled={busy}
                  />
                </label>
              </div>
              {setPasswordResult ? (
                <div
                  style={{
                    border: setPasswordResult.type === "success" ? "1px solid rgba(90, 236, 178, 0.45)" : "1px solid rgba(255, 122, 157, 0.45)",
                    background: setPasswordResult.type === "success" ? "rgba(90, 236, 178, 0.14)" : "rgba(255, 122, 157, 0.14)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: setPasswordResult.type === "success" ? "#ccffe7" : "#ffd6e2",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {setPasswordResult.message}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  style={primaryButtonStyle}
                  disabled={busy || !setPasswordNewPassword.trim() || !setPasswordConfirmPassword.trim()}
                  onClick={handleSetPassword}
                >
                  Set Password
                </button>
                <button
                  style={buttonStyle}
                  disabled={busy}
                  onClick={() => {
                    resetSetPasswordForm();
                    setShowSetPasswordPanel(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeWorkflow === "campaign-members" && canManageCampaignAccess ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Campaign Members: {campaignName}</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                style={buttonStyle}
                disabled={busy}
                onClick={() => setShowCampaignAddPanel((current) => !current)}
              >
                {showCampaignAddPanel ? "Close" : "Add Player"}
              </button>
            </div>
          </div>

          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Choose who can play in this campaign and who can edit campaign content.
          </div>

          {campaignMemberResult ? (
            <div
              style={{
                border: campaignMemberResult.type === "success" ? "1px solid rgba(90, 236, 178, 0.45)" : "1px solid rgba(255, 122, 157, 0.45)",
                background: campaignMemberResult.type === "success" ? "rgba(90, 236, 178, 0.14)" : "rgba(255, 122, 157, 0.14)",
                borderRadius: 10,
                padding: "10px 12px",
                color: campaignMemberResult.type === "success" ? "#ccffe7" : "#ffd6e2",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {campaignMemberResult.message}
            </div>
          ) : null}

          {showCampaignAddPanel ? (
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
                setShowCampaignAddPanel(false);
              }}
            >
              <div
                style={{ ...panelStyle, width: "min(680px, 96vw)", border: "1px solid var(--border-bright)", padding: 14, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <strong>Add Player</strong>
                  <button
                    style={buttonStyle}
                    disabled={busy}
                    onClick={() => {
                      setShowCampaignAddPanel(false);
                      setCampaignUserSearch("");
                      setCampaignAssignUserId("");
                      setCampaignAssignRole("player");
                    }}
                  >
                    Close
                  </button>
                </div>

                <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                  Search Existing User
                  <input
                    type="text"
                    value={campaignUserSearch}
                    onChange={(e) => setCampaignUserSearch(e.target.value)}
                    placeholder="Search by name or email"
                    style={inputStyle}
                    disabled={busy}
                  />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                  <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                    Existing User
                    <select
                      value={campaignAssignUserId}
                      onChange={(e) => setCampaignAssignUserId(e.target.value)}
                      style={inputStyle}
                      disabled={busy}
                    >
                      <option value="">Select user</option>
                      {filteredCampaignCandidateIds.map((userId) => (
                        <option key={userId} value={userId}>
                          {getUserLabel(userId)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                    Member Type
                    <select
                      value={campaignAssignRole}
                      onChange={(e) => setCampaignAssignRole(e.target.value as CampaignAccessRole)}
                      style={inputStyle}
                      disabled={busy}
                    >
                      <option value="player">Player</option>
                      <option value="editor">GM / Editor</option>
                    </select>
                  </label>
                </div>

                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  {filteredCampaignCandidateIds.length === 0
                    ? "No matching users available to add."
                    : `${filteredCampaignCandidateIds.length} matching user${filteredCampaignCandidateIds.length === 1 ? "" : "s"}.`}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <button
                    style={primaryButtonStyle}
                    disabled={busy || !campaignAssignUserId}
                    onClick={() => {
                      if (!campaignAssignUserId) {
                        setCampaignMemberResult({ type: "error", message: "Select a user to add." });
                        return;
                      }
                      void runAction(async () => {
                        await onAssignCampaignAccess({ userId: campaignAssignUserId, role: campaignAssignRole });
                        setCampaignMemberResult({ type: "success", message: "Campaign member added." });
                        setShowCampaignAddPanel(false);
                        setCampaignUserSearch("");
                        setCampaignAssignUserId("");
                        setCampaignAssignRole("player");
                      });
                    }}
                  >
                    Add Player
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr auto", gap: 8, padding: "10px 12px", background: "rgba(16, 30, 58, 0.45)", color: "#b9cdf0", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
              <div>Display Name</div>
              <div>Email</div>
              <div>Role</div>
              <div>Actions</div>
            </div>
            <div style={{ display: "grid", gap: 0 }}>
              {campaignAccessRows.length === 0 ? (
                <div style={{ padding: 12, color: "var(--text-secondary)" }}>No members have campaign access yet.</div>
              ) : (
                campaignAccessRows.map((row) => {
                  const profile = usersById.get(row.user_id);
                  const displayName = profile?.display_name?.trim() || "Unknown user";
                  const email = profile?.email || row.user_id;
                  const removingLastEditor = row.role === "editor" && campaignEditorCount <= 1;

                  return (
                    <div key={`${row.campaign_id}-${row.user_id}`} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr auto", gap: 8, alignItems: "center", padding: "10px 12px", borderTop: "1px solid rgba(58, 78, 127, 0.35)" }}>
                      <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{displayName}</div>
                      <div style={{ color: "var(--text-secondary)" }}>{email}</div>
                      <div style={{ color: "var(--text-secondary)", fontWeight: 600 }}>{campaignRoleLabel(row.role)}</div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
                          style={buttonStyle}
                          disabled={busy}
                          onClick={() => {
                            setCampaignRoleModalUserId(row.user_id);
                            setCampaignRoleModalValue(row.role);
                          }}
                        >
                          Change
                        </button>
                        <button
                          style={buttonStyle}
                          disabled={busy}
                          onClick={() => {
                            if (removingLastEditor) {
                              setCampaignMemberResult({ type: "error", message: "Cannot remove the last campaign editor." });
                              return;
                            }
                            setCampaignRemoveModalUserId(row.user_id);
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

          {campaignRoleModalUserId ? (
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
                setCampaignRoleModalUserId("");
              }}
            >
              <div
                style={{ ...panelStyle, width: "min(560px, 96vw)", border: "1px solid var(--border-bright)", padding: 14, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <strong>Change Member Type</strong>
                  <button style={buttonStyle} disabled={busy} onClick={() => setCampaignRoleModalUserId("")}>Close</button>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{getUserLabel(campaignRoleModalUserId)}</div>
                <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                  Member Type
                  <select
                    value={campaignRoleModalValue}
                    onChange={(e) => setCampaignRoleModalValue(e.target.value as CampaignAccessRole)}
                    style={inputStyle}
                    disabled={busy}
                  >
                    <option value="player">Player</option>
                    <option value="editor">GM / Editor</option>
                  </select>
                </label>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    style={primaryButtonStyle}
                    disabled={busy}
                    onClick={() => {
                      const currentRole = campaignAccessRows.find((row) => row.user_id === campaignRoleModalUserId)?.role;
                      const demotingLastEditor = currentRole === "editor" && campaignRoleModalValue !== "editor" && campaignEditorCount <= 1;
                      if (demotingLastEditor) {
                        setCampaignMemberResult({ type: "error", message: "Cannot change role: this is the last campaign editor." });
                        return;
                      }
                      void runAction(async () => {
                        await onUpdateCampaignAccess({ userId: campaignRoleModalUserId, role: campaignRoleModalValue });
                        setCampaignMemberResult({ type: "success", message: `Member type updated to ${campaignRoleLabel(campaignRoleModalValue)}.` });
                        setCampaignRoleModalUserId("");
                      });
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {campaignRemoveModalUserId ? (
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
                setCampaignRemoveModalUserId("");
              }}
            >
              <div
                style={{ ...panelStyle, width: "min(560px, 96vw)", border: "1px solid var(--border-bright)", padding: 14, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <strong>Remove Member</strong>
                  <button style={buttonStyle} disabled={busy} onClick={() => setCampaignRemoveModalUserId("")}>Close</button>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  Remove {getUserLabel(campaignRemoveModalUserId)} from this campaign?
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    style={buttonStyle}
                    disabled={busy}
                    onClick={() => setCampaignRemoveModalUserId("")}
                  >
                    Cancel
                  </button>
                  <button
                    style={primaryButtonStyle}
                    disabled={busy}
                    onClick={() => {
                      void runAction(async () => {
                        await onRemoveCampaignAccess(campaignRemoveModalUserId);
                        setCampaignMemberResult({ type: "success", message: "Campaign member removed." });
                        setCampaignRemoveModalUserId("");
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeWorkflow === "character-access" && canManageCharacterAccess && characterName ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Character Access: {characterName}</h3>
          </div>

          <div style={{ ...panelStyle, padding: 12, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>Add Character Access</div>
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
                Permission
                <select
                  value={characterAssignRole}
                  onChange={(e) => setCharacterAssignRole(e.target.value as CharacterAccessRole)}
                  style={inputStyle}
                  disabled={busy}
                >
                  {characterRoleOptions.map((role) => (
                    <option key={role} value={role}>
                      {characterRoleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                style={primaryButtonStyle}
                disabled={busy || !characterAssignUserId}
                onClick={() => {
                  if (!characterAssignUserId) return;
                  void runAction(async () => {
                    await onAssignCharacterAccess({ userId: characterAssignUserId, role: characterAssignRole });
                    setCharacterAssignUserId("");
                    setCharacterAssignRole(characterViewerInUse ? "viewer" : "editor");
                  });
                }}
              >
                Add
              </button>
            </div>
          </div>

          <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr auto", gap: 8, padding: "10px 12px", background: "rgba(16, 30, 58, 0.45)", color: "#b9cdf0", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
              <div>User</div>
              <div>Permission</div>
              <div>Actions</div>
            </div>
            <div style={{ display: "grid", gap: 0 }}>
              {characterAccessRows.length === 0 ? (
                <div style={{ padding: 12, color: "var(--text-secondary)" }}>No explicit character access rows.</div>
              ) : (
                characterAccessRows.map((row) => {
                  const rowRoleOptions: CharacterAccessRole[] =
                    row.role === "viewer" ? ["viewer", "editor"] : characterRoleOptions;

                  return (
                    <div key={`${row.character_id}-${row.user_id}`} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr auto", gap: 8, alignItems: "center", padding: "10px 12px", borderTop: "1px solid rgba(58, 78, 127, 0.35)" }}>
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
                        {rowRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {characterRoleLabel(role)}
                          </option>
                        ))}
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
