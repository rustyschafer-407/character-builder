import { useEffect, useMemo, useState } from "react";
import type {
  CampaignAccessRole,
  CampaignAccessRow,
  CharacterAccessRole,
  CharacterAccessRow,
  ProfileRow,
} from "../lib/cloudRepository";
import { getSupabaseClient } from "../lib/supabaseClient";
import { resolveUserEmail, resolveUserName } from "../lib/userDisplay";
import { buttonStyle, dangerButtonStyle, inputStyle, panelStyle, primaryButtonStyle, sectionTitleStyle } from "./uiStyles";

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
  onAssignCampaignAccessByEmail: (input: { email: string; role: CampaignAccessRole }) => Promise<{ deferred: boolean; message: string }>;
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
  onAssignCampaignAccessByEmail,
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
  const [campaignSearchOrEmail, setCampaignSearchOrEmail] = useState("");
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
  const [setPasswordVisible, setSetPasswordVisible] = useState(false);
  const [setPasswordToast, setSetPasswordToast] = useState("");
  const [peopleResult, setPeopleResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [hoveredPeopleRowId, setHoveredPeopleRowId] = useState("");
  const [hoveredCampaignRowId, setHoveredCampaignRowId] = useState("");

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
    const query = campaignSearchOrEmail.trim().toLowerCase();
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
  }, [campaignUserCandidateIds, campaignSearchOrEmail, assignedCampaignUserIds, usersById]);

  useEffect(() => {
    if (workflowOptions.length === 0) {
      return;
    }
    const valid = workflowOptions.some((option) => option.id === activeWorkflow);
    if (!valid) {
      setActiveWorkflow(workflowOptions[0].id);
    }
  }, [activeWorkflow, workflowOptions]);

  useEffect(() => {
    if (!setPasswordToast) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setSetPasswordToast("");
    }, 2400);
    return () => window.clearTimeout(timeoutId);
  }, [setPasswordToast]);

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
    setPeopleResult(null);
  }

  function hasUnsavedEditRoleChanges() {
    if (!selectedEditUser) return false;
    return editUserIsAdmin !== Boolean(selectedEditUser.is_admin) || editUserIsGm !== Boolean(selectedEditUser.is_gm);
  }

  function requestCloseEditModal() {
    if (busy) return;
    if (hasUnsavedEditRoleChanges() && !window.confirm("Discard changes?")) {
      return;
    }
    setShowEditPanel(false);
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
    return role === "editor" ? "GM" : "Player";
  }

  function resetSetPasswordForm() {
    setSetPasswordNewPassword("");
    setSetPasswordConfirmPassword("");
    setSetPasswordResult(null);
    setSetPasswordVisible(false);
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

        setSetPasswordToast("Password updated");
        resetSetPasswordForm();
        setShowSetPasswordPanel(false);
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

      {setPasswordToast ? (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            border: "1px solid rgba(90, 236, 178, 0.45)",
            background: "rgba(90, 236, 178, 0.14)",
            borderRadius: 10,
            padding: "10px 12px",
            color: "#ccffe7",
            fontWeight: 700,
            fontSize: 13,
            zIndex: 85,
            boxShadow: "0 8px 24px rgba(7, 12, 24, 0.35)",
          }}
        >
          {setPasswordToast}
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

          {peopleResult ? (
            <div
              style={{
                border: peopleResult.type === "success" ? "1px solid rgba(90, 236, 178, 0.45)" : "1px solid rgba(255, 122, 157, 0.45)",
                background: peopleResult.type === "success" ? "rgba(90, 236, 178, 0.14)" : "rgba(255, 122, 157, 0.14)",
                borderRadius: 10,
                padding: "10px 12px",
                color: peopleResult.type === "success" ? "#ccffe7" : "#ffd6e2",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {peopleResult.message}
            </div>
          ) : null}

          <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.8fr 1fr auto", gap: 8, padding: "10px 12px", background: "rgba(16, 30, 58, 0.45)", color: "#b9cdf0", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
              <div>Name</div>
              <div>Email</div>
              <div>Roles</div>
              <div>Actions</div>
            </div>
            <div style={{ display: "grid", gap: 0 }}>
              {users.length === 0 ? (
                <div style={{ display: "grid", placeItems: "center", padding: 24, gap: 6, textAlign: "center" }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>No players yet.</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Add a player to get started.</div>
                </div>
              ) : (
                users.map((user) => (
                  <div
                    key={user.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1.8fr 1fr auto",
                      gap: 8,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderTop: "1px solid rgba(58, 78, 127, 0.35)",
                      background: hoveredPeopleRowId === user.id ? "rgba(73, 224, 255, 0.08)" : "transparent",
                      transition: "background 120ms ease",
                    }}
                    onMouseEnter={() => setHoveredPeopleRowId(user.id)}
                    onMouseLeave={() => setHoveredPeopleRowId("")}
                  >
                    <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                      {resolveUserName(user, user.id)}
                    </div>
                    <div style={{ color: "var(--text-secondary)" }}>{user.email || "No email"}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {roleBadges(user).map((badge) => (
                        <span
                          key={`${user.id}-${badge}`}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: badge === "Admin" ? "1px solid rgba(255, 188, 83, 0.65)" : badge === "GM" ? "1px solid rgba(138, 247, 207, 0.6)" : "1px solid #3a4e7f",
                            background: badge === "Admin" ? "rgba(255, 188, 83, 0.2)" : badge === "GM" ? "rgba(138, 247, 207, 0.16)" : "rgba(11, 22, 42, 0.72)",
                            color: badge === "Admin" ? "#ffeacc" : badge === "GM" ? "#d7ffef" : "#d7e8ff",
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
                requestCloseEditModal();
              }}
            >
              <div
                style={{ ...panelStyle, width: "min(620px, 96vw)", border: "1px solid var(--border-bright)", padding: 14, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <strong>Edit User Roles</strong>
                  <button style={buttonStyle} onClick={requestCloseEditModal} disabled={busy}>
                    Close
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                    Display Name
                    <input
                      type="text"
                      value={resolveUserName(selectedEditUser, selectedEditUser.id)}
                      style={inputStyle}
                      readOnly
                      disabled
                    />
                  </label>
                  <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                    Email
                    <input
                      type="email"
                      value={selectedEditUser.email || selectedEditUser.id}
                      style={inputStyle}
                      readOnly
                      disabled
                    />
                  </label>
                </div>

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
                    Can create campaigns (GM)
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
                        setPeopleResult({ type: "success", message: "User updated" });
                        setShowEditPanel(false);
                      });
                    }}
                  >
                    Save
                  </button>
                  <button style={buttonStyle} disabled={busy} onClick={requestCloseEditModal}>
                    Cancel
                  </button>
                  <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255, 122, 157, 0.3)", margin: "0 4px" }} />
                  <button
                    style={{ ...dangerButtonStyle, padding: "9px 12px" }}
                    disabled={busy}
                    onClick={() => {
                      if (!selectedEditUser) return;
                      if (!window.confirm(`Delete user ${getUserLabel(selectedEditUser.id)}? This removes their login and cannot be undone.`)) {
                        return;
                      }
                      void runAction(async () => {
                        await onDeleteUser({ userId: selectedEditUser.id });
                        setPeopleResult({ type: "success", message: "User removed" });
                        setShowEditPanel(false);
                      });
                    }}
                  >
                    Delete User
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {showSetPasswordPanel && selectedEditUser ? (
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
                setShowSetPasswordPanel(false);
              }}
            >
              <div
                style={{ ...panelStyle, width: "min(620px, 96vw)", border: "1px solid var(--border-bright)", padding: 14, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <strong>Set Password</strong>
                  <button style={buttonStyle} onClick={() => setShowSetPasswordPanel(false)} disabled={busy}>
                    Close
                  </button>
                </div>

                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  Set a new password for this user?
                </div>

                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  User: {resolveUserName(selectedEditUser, selectedEditUser.id)} ({selectedEditUser.email || selectedEditUser.id})
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                    New Password
                    <input
                      type={setPasswordVisible ? "text" : "password"}
                      className="password-visibility-input"
                      data-mask={setPasswordVisible ? "false" : "true"}
                      autoComplete="new-password"
                      value={setPasswordNewPassword}
                      onChange={(e) => setSetPasswordNewPassword(e.target.value)}
                      style={inputStyle}
                      disabled={busy}
                    />
                  </label>
                  <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                    Confirm Password
                    <input
                      type={setPasswordVisible ? "text" : "password"}
                      className="password-visibility-input"
                      data-mask={setPasswordVisible ? "false" : "true"}
                      autoComplete="new-password"
                      value={setPasswordConfirmPassword}
                      onChange={(e) => setSetPasswordConfirmPassword(e.target.value)}
                      style={inputStyle}
                      disabled={busy}
                    />
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#b9cdf0", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={setPasswordVisible}
                      onChange={(e) => setSetPasswordVisible(e.target.checked)}
                      disabled={busy}
                    />
                    Show passwords
                  </label>
                </div>

                {setPasswordResult ? (
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
            Who can access this campaign and who can manage it.
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
                      setCampaignSearchOrEmail("");
                      setCampaignAssignUserId("");
                      setCampaignAssignRole("player");
                    }}
                  >
                    Close
                  </button>
                </div>

                <label style={{ fontWeight: 600, color: "#b9cdf0" }}>
                  Search or enter email
                  <input
                    type="text"
                    value={campaignSearchOrEmail}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCampaignSearchOrEmail(value);
                      const normalized = value.trim().toLowerCase();
                      const matchedUserId = filteredCampaignCandidateIds.find((userId) => {
                        const profile = usersById.get(userId);
                        const email = profile?.email?.toLowerCase() ?? "";
                        return email === normalized;
                      });
                      setCampaignAssignUserId(matchedUserId ?? "");
                    }}
                    placeholder="Search by name, or enter email"
                    list="campaign-user-candidate-list"
                    style={inputStyle}
                    disabled={busy}
                  />
                </label>

                <datalist id="campaign-user-candidate-list">
                  {filteredCampaignCandidateIds.map((userId) => {
                    const profile = usersById.get(userId);
                    const email = profile?.email?.trim();
                    if (!email) return null;
                    return <option key={userId} value={email} label={getUserLabel(userId)} />;
                  })}
                </datalist>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                  <label style={{ fontWeight: 600, color: "#b9cdf0", maxWidth: 280 }}>
                    Member Type
                    <select
                      value={campaignAssignRole}
                      onChange={(e) => setCampaignAssignRole(e.target.value as CampaignAccessRole)}
                      style={inputStyle}
                      disabled={busy}
                    >
                      <option value="player">Player</option>
                      <option value="editor">GM</option>
                    </select>
                  </label>
                </div>

                <div style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.45 }}>
                  Player: can create and manage their own characters
                  <br />
                  GM: can edit the campaign and all characters
                </div>

                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  {campaignAssignUserId
                    ? "Matched existing user. Access will be applied now."
                    : "User will get access after they sign in."}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <button
                    style={primaryButtonStyle}
                    disabled={busy || !campaignSearchOrEmail.trim()}
                    onClick={() => {
                      const inputValue = campaignSearchOrEmail.trim();
                      if (!inputValue) {
                        setCampaignMemberResult({ type: "error", message: "Enter a name or email." });
                        return;
                      }

                      void runAction(async () => {
                        const normalized = inputValue.toLowerCase();
                        const matchedUserId = campaignAssignUserId ||
                          filteredCampaignCandidateIds.find((userId) => {
                            const profile = usersById.get(userId);
                            const email = profile?.email?.toLowerCase() ?? "";
                            return email === normalized;
                          }) || "";

                        if (matchedUserId) {
                          await onAssignCampaignAccess({ userId: matchedUserId, role: campaignAssignRole });
                          setCampaignMemberResult({ type: "success", message: "Player added to campaign" });
                        } else {
                          const result = await onAssignCampaignAccessByEmail({ email: inputValue, role: campaignAssignRole });
                          setCampaignMemberResult({
                            type: "success",
                            message: result.message,
                          });
                        }

                        setShowCampaignAddPanel(false);
                        setCampaignSearchOrEmail("");
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
                <div style={{ display: "grid", placeItems: "center", padding: 24, gap: 6, textAlign: "center" }}>
                  <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>No players in this campaign.</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Add a player to start building characters.</div>
                </div>
              ) : (
                campaignAccessRows.map((row) => {
                  const profile = usersById.get(row.user_id);
                  const displayName = resolveUserName(profile, row.user_id);
                  const email = resolveUserEmail(profile, row.user_id);
                  const removingLastEditor = row.role === "editor" && campaignEditorCount <= 1;

                  return (
                    <div
                      key={`${row.campaign_id}-${row.user_id}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1.4fr 1fr auto",
                        gap: 8,
                        alignItems: "center",
                        padding: "10px 12px",
                        borderTop: "1px solid rgba(58, 78, 127, 0.35)",
                        background: hoveredCampaignRowId === row.user_id ? "rgba(73, 224, 255, 0.08)" : "transparent",
                        transition: "background 120ms ease",
                      }}
                      onMouseEnter={() => setHoveredCampaignRowId(row.user_id)}
                      onMouseLeave={() => setHoveredCampaignRowId("")}
                    >
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
                              setCampaignMemberResult({ type: "error", message: "Cannot remove the last GM." });
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
                    <option value="editor">GM</option>
                  </select>
                </label>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.45 }}>
                  Player: can create and manage their own characters
                  <br />
                  GM: can edit the campaign and all characters
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    style={primaryButtonStyle}
                    disabled={busy}
                    onClick={() => {
                      const currentRole = campaignAccessRows.find((row) => row.user_id === campaignRoleModalUserId)?.role;
                      const demotingLastEditor = currentRole === "editor" && campaignRoleModalValue !== "editor" && campaignEditorCount <= 1;
                      if (demotingLastEditor) {
                        setCampaignMemberResult({ type: "error", message: "Cannot change role: this is the last GM." });
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
