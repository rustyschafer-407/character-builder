import { useCallback, useEffect, useMemo, useState } from "react";
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
  onCreateCampaignInvite: (input: { email?: string; role: CampaignAccessRole }) => Promise<{ ok: boolean; message: string; inviteUrl: string }>;
  onListCampaignInvites: () => Promise<{
    ok: boolean;
    message: string;
    invites: Array<{
      id: string;
      token: string;
      campaign_id: string;
      email: string | null;
      role: CampaignAccessRole;
      expires_at: string;
      used_at: string | null;
      created_at: string;
      inviteUrl: string;
    }>;
  }>;
  onRevokeCampaignInvite: (input: { inviteId: string }) => Promise<{ ok: boolean; message: string }>;
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
  characterUserCandidateIds,
  getUserLabel,
  onSaveUserRoles,
  onDeleteUser,
  onCreatePlayer,
  onCreateCampaignInvite,
  onListCampaignInvites,
  onRevokeCampaignInvite,
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
  const [campaignInviteLink, setCampaignInviteLink] = useState("");
  const [campaignInvites, setCampaignInvites] = useState<
    Array<{
      id: string;
      token: string;
      campaign_id: string;
      email: string | null;
      role: CampaignAccessRole;
      expires_at: string;
      used_at: string | null;
      created_at: string;
      inviteUrl: string;
    }>
  >([]);
  const [campaignInvitesLoading, setCampaignInvitesLoading] = useState(false);
  const [campaignMemberResult, setCampaignMemberResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [campaignRoleModalUserId, setCampaignRoleModalUserId] = useState("");
  const [campaignRoleModalValue, setCampaignRoleModalValue] = useState<CampaignAccessRole>("player");
  const [campaignRemoveModalUserId, setCampaignRemoveModalUserId] = useState("");

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
  function resetCampaignInviteForm() {
    setCampaignSearchOrEmail("");
    setCampaignAssignRole("player");
    setCampaignInviteLink("");
  }

  function campaignInviteStatus(invite: { expires_at: string; used_at: string | null }) {
    if (invite.used_at) return "Used" as const;
    const expiresMs = Date.parse(invite.expires_at);
    if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return "Expired" as const;
    return "Active" as const;
  }

  function campaignInviteExpiresInText(expiresAt: string) {
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs)) return "Invite expiration unavailable";

    const daysRemaining = Math.max(0, Math.ceil((expiresMs - Date.now()) / (24 * 60 * 60 * 1000)));
    return `Invite expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  }

  const reloadCampaignInvites = useCallback(async () => {
    setCampaignInvitesLoading(true);
    try {
      const result = await onListCampaignInvites();
      if (!result.ok) {
        setCampaignMemberResult({ type: "error", message: result.message });
        return;
      }
      setCampaignInvites(result.invites);
    } finally {
      setCampaignInvitesLoading(false);
    }
  }, [onListCampaignInvites]);

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

  useEffect(() => {
    if (!showCampaignAddPanel) {
      return;
    }

    void reloadCampaignInvites();
  }, [showCampaignAddPanel, reloadCampaignInvites]);

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

  const trimmedCreatePlayerName = createPlayerDisplayName.trim();
  const trimmedCreatePlayerEmail = createPlayerEmail.trim();
  const createPlayerPasswordTooShort = createPlayerTemporaryPassword.length > 0 && createPlayerTemporaryPassword.length < 8;
  const canSubmitCreatePlayer =
    Boolean(trimmedCreatePlayerName) &&
    Boolean(trimmedCreatePlayerEmail) &&
    createPlayerTemporaryPassword.length >= 8;

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
    <section style={{ ...panelStyle, marginBottom: 24, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={{ ...sectionTitleStyle, margin: 0 }}>Permissions</h2>
        {errorMessage ? (
          <button onClick={onClearError} className="button-control" style={buttonStyle}>
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
            border: "1px solid var(--cb-danger-soft-border)",
            background: "var(--cb-danger-soft)",
            borderRadius: 10,
            padding: "12px 12px 12px",
            color: "var(--cb-danger-text)",
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
            border: "1px solid var(--cb-success-soft-border)",
            background: "var(--cb-success-soft)",
            borderRadius: 10,
            padding: "12px 12px 12px",
            color: "var(--cb-success-text)",
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>People</h3>
            <button
              className="button-control" style={primaryButtonStyle}
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
                border: peopleResult.type === "success" ? "1px solid var(--cb-success-soft-border)" : "1px solid var(--cb-danger-soft-border)",
                background: peopleResult.type === "success" ? "var(--cb-success-soft)" : "var(--cb-danger-soft)",
                borderRadius: 10,
                padding: "12px 12px 12px",
                color: peopleResult.type === "success" ? "var(--cb-success-text)" : "var(--cb-danger-text)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {peopleResult.message}
            </div>
          ) : null}

          <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.8fr 1fr auto", gap: 8, padding: "12px 12px 12px", background: "rgba(16, 30, 58, 0.45)", color: "var(--cb-muted-label)", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
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
                      padding: "12px 12px 12px",
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
                            border: badge === "Admin" ? "1px solid rgba(255, 188, 83, 0.65)" : badge === "GM" ? "1px solid rgba(138, 247, 207, 0.6)" : "1px solid var(--cb-input-border)",
                            background: badge === "Admin" ? "rgba(255, 188, 83, 0.2)" : badge === "GM" ? "rgba(138, 247, 207, 0.16)" : "var(--cb-surface)",
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
                      <button className="button-control" style={buttonStyle} disabled={busy} onClick={() => openEditUser(user)}>
                        Edit
                      </button>
                      <button
                        className="button-control" style={buttonStyle}
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
            <div style={{ ...panelStyle, border: "1px solid var(--border-bright)", padding: 12, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <strong>Add Player</strong>
                <button className="button-control" style={buttonStyle} onClick={() => setShowCreatePlayerPanel(false)} disabled={busy}>
                  Close
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                  Display Name
                  <input
                    type="text"
                    value={createPlayerDisplayName}
                    onChange={(e) => setCreatePlayerDisplayName(e.target.value)}
                    className="form-control" style={inputStyle}
                    disabled={busy}
                  />
                </label>
                <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                  Email
                  <input
                    type="email"
                    value={createPlayerEmail}
                    onChange={(e) => setCreatePlayerEmail(e.target.value)}
                    className="form-control" style={inputStyle}
                    disabled={busy}
                  />
                </label>
              </div>
              <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                Temporary Password
                <input
                  type="password"
                  value={createPlayerTemporaryPassword}
                  onChange={(e) => setCreatePlayerTemporaryPassword(e.target.value)}
                  className="form-control" style={inputStyle}
                  disabled={busy}
                />
              </label>
              {createPlayerPasswordTooShort ? (
                <div style={{ color: "var(--cb-danger-text)", fontSize: 13, fontWeight: 600 }}>
                  Temporary password must be at least 8 characters.
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <label className="tap-row" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cb-muted-label)", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={createPlayerIsGm}
                    onChange={(e) => setCreatePlayerIsGm(e.target.checked)}
                    disabled={busy}
                  />
                  Can create campaigns
                </label>
                <label className="tap-row" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cb-muted-label)", fontWeight: 600 }}>
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
                    border: createPlayerResult.type === "success" ? "1px solid var(--cb-success-soft-border)" : "1px solid var(--cb-danger-soft-border)",
                    background: createPlayerResult.type === "success" ? "var(--cb-success-soft)" : "var(--cb-danger-soft)",
                    borderRadius: 10,
                    padding: "12px 12px 12px",
                    color: createPlayerResult.type === "success" ? "var(--cb-success-text)" : "var(--cb-danger-text)",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  {createPlayerResult.message}
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  style={{
                    ...primaryButtonStyle,
                    opacity: busy || !canSubmitCreatePlayer ? 0.55 : 1,
                    cursor: busy || !canSubmitCreatePlayer ? "not-allowed" : "pointer",
                  }}
                  disabled={busy || !canSubmitCreatePlayer}
                  onClick={() => {
                    void runAction(async () => {
                      const result = await onCreatePlayer({
                        displayName: trimmedCreatePlayerName,
                        email: trimmedCreatePlayerEmail,
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
                  {busy ? "Creating..." : "Create Player"}
                </button>
                <button
                  className="button-control" style={buttonStyle}
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
                background: "var(--cb-modal-overlay)",
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
                style={{ ...panelStyle, width: "min(620px, 96vw)", border: "1px solid var(--border-bright)", padding: 16, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong>Edit User Roles</strong>
                  <button className="button-control" style={buttonStyle} onClick={requestCloseEditModal} disabled={busy}>
                    Close
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    Display Name
                    <input
                      type="text"
                      value={resolveUserName(selectedEditUser, selectedEditUser.id)}
                      className="form-control" style={inputStyle}
                      readOnly
                      disabled
                    />
                  </label>
                  <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    Email
                    <input
                      type="email"
                      value={selectedEditUser.email || selectedEditUser.id}
                      className="form-control" style={inputStyle}
                      readOnly
                      disabled
                    />
                  </label>
                </div>

                <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <label className="tap-row" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cb-muted-label)", fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={editUserIsAdmin}
                      onChange={(e) => setEditUserIsAdmin(e.target.checked)}
                      disabled={busy}
                    />
                    Admin
                  </label>
                  <label className="tap-row" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--cb-muted-label)", fontWeight: 600 }}>
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
                    className="button-control" style={primaryButtonStyle}
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
                  <button className="button-control" style={buttonStyle} disabled={busy} onClick={requestCloseEditModal}>
                    Close
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
                background: "var(--cb-modal-overlay)",
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
                style={{ ...panelStyle, width: "min(620px, 96vw)", border: "1px solid var(--border-bright)", padding: 16, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong>Set Password</strong>
                  <button className="button-control" style={buttonStyle} onClick={() => setShowSetPasswordPanel(false)} disabled={busy}>
                    Close
                  </button>
                </div>

                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  Set a new password for this user?
                </div>

                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  User: {resolveUserName(selectedEditUser, selectedEditUser.id)} ({selectedEditUser.email || selectedEditUser.id})
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    New Password
                    <input
                      key={`set-password-new-${setPasswordVisible ? "visible" : "hidden"}`}
                      type={setPasswordVisible ? "text" : "password"}
                      autoComplete="new-password"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={setPasswordNewPassword}
                      onChange={(e) => setSetPasswordNewPassword(e.target.value)}
                      className="form-control" style={inputStyle}
                      disabled={busy}
                    />
                  </label>
                  <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    Confirm Password
                    <input
                      key={`set-password-confirm-${setPasswordVisible ? "visible" : "hidden"}`}
                      type={setPasswordVisible ? "text" : "password"}
                      autoComplete="new-password"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={setPasswordConfirmPassword}
                      onChange={(e) => setSetPasswordConfirmPassword(e.target.value)}
                      className="form-control" style={inputStyle}
                      disabled={busy}
                    />
                  </label>
                  <label className="tap-row" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--cb-muted-label)", fontWeight: 600 }}>
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
                      border: "1px solid var(--cb-danger-soft-border)",
                      background: "var(--cb-danger-soft)",
                      borderRadius: 10,
                      padding: "12px 12px 12px",
                      color: "var(--cb-danger-text)",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {setPasswordResult.message}
                  </div>
                ) : null}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    className="button-control" style={primaryButtonStyle}
                    disabled={busy || !setPasswordNewPassword.trim() || !setPasswordConfirmPassword.trim()}
                    onClick={handleSetPassword}
                  >
                    Set Password
                  </button>
                  <button
                    className="button-control" style={buttonStyle}
                    disabled={busy}
                    onClick={() => {
                      resetSetPasswordForm();
                      setShowSetPasswordPanel(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeWorkflow === "campaign-members" && canManageCampaignAccess ? (
        <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, padding: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Campaign Members: {campaignName}</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                className="button-control" style={buttonStyle}
                disabled={busy}
                onClick={() => {
                  setShowCampaignAddPanel((current) => {
                    const next = !current;
                    if (!next) {
                      resetCampaignInviteForm();
                    }
                    return next;
                  });
                }}
              >
                {showCampaignAddPanel ? "Close" : "Invite Link"}
              </button>
            </div>
          </div>

          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
            Who can access this campaign and who can manage it.
          </div>

          {campaignMemberResult ? (
            <div
              style={{
                border: campaignMemberResult.type === "success" ? "1px solid var(--cb-success-soft-border)" : "1px solid var(--cb-danger-soft-border)",
                background: campaignMemberResult.type === "success" ? "var(--cb-success-soft)" : "var(--cb-danger-soft)",
                borderRadius: 10,
                padding: "12px 12px 12px",
                color: campaignMemberResult.type === "success" ? "var(--cb-success-text)" : "var(--cb-danger-text)",
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
                background: "var(--cb-modal-overlay)",
                display: "grid",
                placeItems: "center",
                padding: 16,
                zIndex: 60,
              }}
              onClick={() => {
                if (busy) return;
                setShowCampaignAddPanel(false);
                resetCampaignInviteForm();
              }}
            >
              <div
                style={{ ...panelStyle, width: "min(680px, 96vw)", border: "1px solid var(--border-bright)", padding: 16, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong>Invite a Player</strong>
                  <button
                    className="button-control" style={buttonStyle}
                    disabled={busy}
                    onClick={() => {
                      setShowCampaignAddPanel(false);
                      resetCampaignInviteForm();
                    }}
                  >
                    Close
                  </button>
                </div>

                <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                  Email (optional)
                  <input
                    type="email"
                    value={campaignSearchOrEmail}
                    onChange={(e) => setCampaignSearchOrEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="form-control" style={inputStyle}
                    disabled={busy}
                  />
                </label>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: -4 }}>
                  Leave email blank to create a link anyone can use.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                  <label style={{ fontWeight: 600, color: "var(--cb-muted-label)", maxWidth: 280 }}>
                    Role
                    <select
                      value={campaignAssignRole}
                      onChange={(e) => setCampaignAssignRole(e.target.value as CampaignAccessRole)}
                      className="form-control" style={inputStyle}
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

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="button-control" style={primaryButtonStyle}
                    disabled={busy}
                    onClick={() => {
                      void runAction(async () => {
                        const email = campaignSearchOrEmail.trim().toLowerCase();
                        const result = await onCreateCampaignInvite({ email: email || undefined, role: campaignAssignRole });
                        if (!result.ok) {
                          setCampaignMemberResult({ type: "error", message: result.message });
                          return;
                        }

                        setCampaignInviteLink(result.inviteUrl);
                        await reloadCampaignInvites();
                        setCampaignMemberResult({ type: "success", message: "Invite link ready." });
                      });
                    }}
                  >
                    Generate Invite Link
                  </button>
                </div>

                {campaignInviteLink ? (
                  <div style={{ display: "grid", gap: 8, border: "1px solid var(--cb-success-soft-border)", background: "var(--cb-success-soft)", borderRadius: 10, padding: 12, marginTop: 8 }}>
                    <div style={{ fontWeight: 700, color: "var(--cb-success-text)" }}>Invite link ready</div>
                    <label style={{ fontWeight: 600, color: "var(--cb-success-text)" }}>
                      Link
                      <input
                        type="text"
                        readOnly
                        value={campaignInviteLink}
                        className="form-control"
                        style={{ ...inputStyle, marginTop: 6 }}
                      />
                    </label>
                    <div style={{ color: "var(--cb-success-text)", fontSize: 12, fontWeight: 600 }}>
                      Expires in 7 days
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="button-control"
                        style={primaryButtonStyle}
                        onClick={() => {
                          void (async () => {
                            try {
                              await navigator.clipboard.writeText(campaignInviteLink);
                              setCampaignMemberResult({ type: "success", message: "Invite link copied." });
                            } catch {
                              setCampaignMemberResult({ type: "error", message: "Could not copy. Select the link and copy it manually." });
                            }
                          })();
                        }}
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>Existing invites</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {campaignInvitesLoading ? (
                      <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>Loading invites...</div>
                    ) : campaignInvites.length === 0 ? (
                      <div style={{ padding: 12, color: "var(--text-secondary)", fontSize: 13 }}>No invites yet.</div>
                    ) : (
                      campaignInvites.map((invite) => {
                        const status = campaignInviteStatus(invite);
                        const statusText =
                          status === "Active"
                            ? `Active • ${campaignInviteExpiresInText(invite.expires_at).replace("Invite ", "")}`
                            : status === "Used"
                              ? "Used • Already used"
                              : "Expired • Invite has expired";

                        return (
                          <div
                            key={invite.id}
                            style={{
                              border: "1px solid var(--border-soft)",
                              borderRadius: 10,
                              padding: 12,
                              display: "grid",
                              gap: 8,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                              <div style={{ display: "grid", gap: 4 }}>
                                <div style={{ color: "var(--text-primary)", fontWeight: 700 }}>
                                  {invite.email || "Open Invite"} ({campaignRoleLabel(invite.role)})
                                </div>
                                <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{statusText}</div>
                              </div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  className="button-control"
                                  style={buttonStyle}
                                  disabled={busy}
                                  onClick={() => {
                                    void (async () => {
                                      try {
                                        await navigator.clipboard.writeText(invite.inviteUrl);
                                        setCampaignMemberResult({ type: "success", message: "Invite link copied." });
                                      } catch {
                                        setCampaignMemberResult({ type: "error", message: "Could not copy. Select the link and copy it manually." });
                                      }
                                    })();
                                  }}
                                >
                                  Copy
                                </button>
                                <button
                                  className="button-control"
                                  style={buttonStyle}
                                  disabled={busy}
                                  onClick={() => {
                                    if (!window.confirm("Revoke this invite link?")) {
                                      return;
                                    }

                                    void runAction(async () => {
                                      const result = await onRevokeCampaignInvite({ inviteId: invite.id });
                                      if (!result.ok) {
                                        setCampaignMemberResult({ type: "error", message: result.message });
                                        return;
                                      }

                                      await reloadCampaignInvites();
                                      if (campaignInviteLink === invite.inviteUrl) {
                                        setCampaignInviteLink("");
                                      }
                                      setCampaignMemberResult({ type: "success", message: "Invite revoked." });
                                    });
                                  }}
                                >
                                  Revoke
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ border: "1px solid var(--border-soft)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr auto", gap: 8, padding: "12px 12px 12px", background: "rgba(16, 30, 58, 0.45)", color: "var(--cb-muted-label)", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
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
                        padding: "12px 12px 12px",
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
                          className="button-control" style={buttonStyle}
                          disabled={busy}
                          onClick={() => {
                            setCampaignRoleModalUserId(row.user_id);
                            setCampaignRoleModalValue(row.role);
                          }}
                        >
                          Change
                        </button>
                        <button
                          className="button-control" style={buttonStyle}
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
                background: "var(--cb-modal-overlay)",
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
                style={{ ...panelStyle, width: "min(560px, 96vw)", border: "1px solid var(--border-bright)", padding: 16, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong>Change Role</strong>
                  <button className="button-control" style={buttonStyle} disabled={busy} onClick={() => setCampaignRoleModalUserId("")}>Close</button>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{getUserLabel(campaignRoleModalUserId)}</div>
                <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                  Role
                  <select
                    value={campaignRoleModalValue}
                    onChange={(e) => setCampaignRoleModalValue(e.target.value as CampaignAccessRole)}
                    className="form-control" style={inputStyle}
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
                    className="button-control" style={primaryButtonStyle}
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
                background: "var(--cb-modal-overlay)",
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
                style={{ ...panelStyle, width: "min(560px, 96vw)", border: "1px solid var(--border-bright)", padding: 16, display: "grid", gap: 12 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <strong>Remove Member</strong>
                  <button className="button-control" style={buttonStyle} disabled={busy} onClick={() => setCampaignRemoveModalUserId("")}>Close</button>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                  Remove {getUserLabel(campaignRemoveModalUserId)} from this campaign?
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    className="button-control" style={buttonStyle}
                    disabled={busy}
                    onClick={() => setCampaignRemoveModalUserId("")}
                  >
                    Close
                  </button>
                  <button
                    className="button-control" style={primaryButtonStyle}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, color: "var(--text-primary)" }}>Character Access: {characterName}</h3>
          </div>

          <div style={{ ...panelStyle, padding: 12, display: "grid", gap: 12 }}>
            <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>Add Character Access</div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 12, alignItems: "end" }}>
              <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                User
                <select
                  value={characterAssignUserId}
                  onChange={(e) => setCharacterAssignUserId(e.target.value)}
                  className="form-control" style={inputStyle}
                  disabled={busy}
                >
                  <option value="">Choose user</option>
                  {characterUserCandidateIds.map((userId) => (
                    <option key={userId} value={userId}>
                      {getUserLabel(userId)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontWeight: 600, color: "var(--cb-muted-label)" }}>
                Permission
                <select
                  value={characterAssignRole}
                  onChange={(e) => setCharacterAssignRole(e.target.value as CharacterAccessRole)}
                  className="form-control" style={inputStyle}
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
                className="button-control" style={primaryButtonStyle}
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
            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr auto", gap: 8, padding: "12px 12px 12px", background: "rgba(16, 30, 58, 0.45)", color: "var(--cb-muted-label)", fontWeight: 700, fontSize: 12, letterSpacing: "0.03em" }}>
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
                    <div key={`${row.character_id}-${row.user_id}`} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr auto", gap: 8, alignItems: "center", padding: "12px 12px 12px", borderTop: "1px solid rgba(58, 78, 127, 0.35)" }}>
                      <div style={{ color: "var(--text-primary)", fontWeight: 600 }}>{getUserLabel(row.user_id)}</div>
                      <select
                        value={row.role}
                        onChange={(e) => {
                          const nextRole = e.target.value as CharacterAccessRole;
                          void runAction(() => onUpdateCharacterAccess({ userId: row.user_id, role: nextRole }));
                        }}
                        className="form-control" style={inputStyle}
                        disabled={busy}
                      >
                        {rowRoleOptions.map((role) => (
                          <option key={role} value={role}>
                            {characterRoleLabel(role)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="button-control" style={buttonStyle}
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
