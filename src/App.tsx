import { useCallback, useEffect, useMemo, useState } from "react";
import { gameData as seedGameData } from "./data/gameData";
import {
  createCharacterFromCampaignAndClass,
  getAttributeModifier,
  getClassById,
  getRaceById,
  makeBaseAttributes,
  sortByName,
} from "./lib/character";
import { makePointBuyBaseAttributes } from "./lib/pointBuy";
import { DEFAULT_EXPORTER_ID, exportCharacter } from "./lib/exporters";
import {
  type CampaignAccessRow,
  type ProfileRow,
  type CharacterAccessRow,
  deleteCampaignAccessRow,
  deleteCharacterAccessRow,
  getAccessContext,
  ensureProfileExists,
  getProfileByEmail,
  deleteUserAccount,
  updateUserRoles,
  claimCampaignEmailAccessInvites,
  listCampaignAccessRows,
  listCharacterAccessRows,
  listManageableProfiles,
  upsertCampaignAccessRow,
  upsertCampaignAccessInviteByEmail,
  upsertCharacterAccessRow,
} from "./lib/cloudRepository";
import {
  getCurrentSession,
  getSessionUser,
  onAuthStateChange,
  requestEmailSignIn,
  signInWithGoogle,
  signOut,
} from "./lib/authRepository";
import { getRememberMePreference, hasSupabaseEnv, setRememberMePreference } from "./lib/supabaseClient";
import { resolveUserEmail, resolveUserName } from "./lib/userDisplay";
import type { CharacterRecord } from "./types/character";
import type {
  AttributeKey,
  GameData,
} from "./types/gameData";

import Sidebar from "./components/Sidebar";
import DisplaySettings from "./components/DisplaySettings";
import CharacterCreationWizard, {
  type CharacterCreationDraft,
} from "./components/CharacterCreationWizard";
import AdminScreen from "./components/AdminScreen";
import AccessManagementPanel from "./components/AccessManagementPanel";
import SelectedCharacterWorkspace from "./components/SelectedCharacterWorkspace";
import { useCharacterCreation } from "./hooks/useCharacterCreation";
import { useCampaignState } from "./hooks/useCampaignState";
import { useCampaignAdminSession } from "./hooks/useCampaignAdminSession";
import { useCharacterState } from "./hooks/useCharacterState";
import { useCharacterEditor } from "./hooks/useCharacterEditor";
import { useCloudSync } from "./hooks/useCloudSync";
import { useLevelUpWorkflow } from "./hooks/useLevelUpWorkflow";
import { useSelectedCharacterWorkspaceCallbacks } from "./hooks/useSelectedCharacterWorkspaceCallbacks";
import { buttonStyle, inputStyle, mutedTextStyle, pageStyle, panelStyle, primaryButtonStyle } from "./components/uiStyles";
import {
  applyDisplayPreferences,
  readDisplayPreferences,
  persistDisplayPreferences,
  type DisplayPreferences,
} from "./lib/displayPreferences";

const rememberedEmailStorageKey = "character-builder.rememberedEmail";

function readRememberedEmail() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(rememberedEmailStorageKey) ?? "";
  } catch {
    return "";
  }
}

function writeRememberedEmail(email: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(rememberedEmailStorageKey, email);
  } catch {
    // Ignore storage write errors; auth still works without remembered email.
  }
}

function clearRememberedEmail() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(rememberedEmailStorageKey);
  } catch {
    // Ignore storage removal errors.
  }
}

function applyClassAttributeModifiers(
  attributes: Record<AttributeKey, number>,
  cls: { attributeBonuses?: Array<{ attribute: AttributeKey; amount: number }> } | null,
  race: { attributeBonuses?: Array<{ attribute: AttributeKey; amount: number }> } | null
) {
  const next = { ...attributes };
  for (const bonus of cls?.attributeBonuses ?? []) {
    next[bonus.attribute] = (next[bonus.attribute] ?? 0) + bonus.amount;
  }
  for (const bonus of race?.attributeBonuses ?? []) {
    next[bonus.attribute] = (next[bonus.attribute] ?? 0) + bonus.amount;
  }
  return next;
}

function makeDraftFromCampaignClassAndRace(
  gameData: GameData,
  campaignId: string,
  raceId: string,
  classId: string,
  name: string
) {
  const campaign = gameData.campaigns.find((g) => g.id === campaignId);
  const race = campaign?.races?.find((r) => r.id === raceId) ?? null;
  const cls = campaign?.classes.find((c) => c.id === classId);
  if (!campaign || !cls) return null;

  const base = createCharacterFromCampaignAndClass(campaign, cls, name, race);

  const draft: CharacterCreationDraft = {
    identity: base.identity,
    campaignId: base.campaignId,
    raceId: base.raceId ?? raceId,
    classId: base.classId,
    level: base.level,
    proficiencyBonus: base.proficiencyBonus,
    attributes: base.attributes,
    saveProf: { ...base.sheet.saveProf },
    attributeGeneration: base.attributeGeneration,
    hp: base.hp,
    skills: base.skills,
    powers: base.powers,
    inventory: base.inventory,
    attacks: base.attacks,
    levelProgression: base.levelProgression,
  };

  const method = draft.attributeGeneration?.method ?? campaign.attributeRules.generationMethods[0] ?? "pointBuy";
  if (method === "manual") {
    draft.attributes = makeBaseAttributes();
  } else if (method === "pointBuy") {
    draft.attributes = applyClassAttributeModifiers(makePointBuyBaseAttributes(), cls, race);
  } else {
    draft.attributes = applyClassAttributeModifiers(makeBaseAttributes(), cls, race);
  }

  const hpMax = Math.max(1, cls.hpRule.hitDie + getAttributeModifier(draft.attributes.CON));
  draft.hp = {
    ...draft.hp,
    max: hpMax,
    current: hpMax,
    hitDie: cls.hpRule.hitDie,
  };

  return draft;
}

export default function App() {
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(() => readDisplayPreferences());
  const cloudEnabled = hasSupabaseEnv();
  const [authReady, setAuthReady] = useState(false);
  const [authRememberMe, setAuthRememberMe] = useState(() => getRememberMePreference());
  const [authEmail, setAuthEmail] = useState(() => (getRememberMePreference() ? readRememberedEmail() : ""));
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [useEmailFallback, setUseEmailFallback] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<ProfileRow | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGm, setIsGm] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [campaignRolesByCampaignId, setCampaignRolesByCampaignId] = useState<Record<string, "player" | "editor">>({});
  const [characterRolesByCharacterId, setCharacterRolesByCharacterId] = useState<Record<string, "viewer" | "editor">>({});
  const {
    selectedCharacterId,
    setSelectedCharacterId,
    commitCreatedCharacter,
    updateCharacter,
  } = useCharacterState();
  const {
    selectedCampaignId,
    setSelectedCampaignId,
    handleCampaignChange: applyCampaignChange,
  } = useCampaignState({
    cloudEnabled,
    initialCampaignId: seedGameData.campaigns[0]?.id ?? "",
  });

  const selectedId = selectedCharacterId;
  const setSelectedId = setSelectedCharacterId;
  const campaignId = selectedCampaignId;
  const setCampaignId = setSelectedCampaignId;
  const [raceId, setRaceId] = useState("");
  const [classId, setClassId] = useState("");
  const [manageableUsers, setManageableUsers] = useState<ProfileRow[]>([]);
  const [campaignAccessRows, setCampaignAccessRows] = useState<CampaignAccessRow[]>([]);
  const [characterAccessRows, setCharacterAccessRows] = useState<CharacterAccessRow[]>([]);
  const [accessManagementError, setAccessManagementError] = useState("");

  useEffect(() => {
    applyDisplayPreferences(displayPreferences);
    persistDisplayPreferences(displayPreferences);
  }, [displayPreferences]);

  const {
    gameData,
    setGameData,
    characters,
    setCharacters,
    campaignRowIdsByAppId,
    cloudStatus,
    setCloudStatus,
    cloudLoadComplete,
    persistCampaignChanges,
    persistCharacterUpsert,
    persistCharacterDelete,
  } = useCloudSync({
    cloudEnabled,
    currentUserId,
    setIsAdmin,
    setIsGm,
    setCampaignRolesByCampaignId,
    setCharacterRolesByCharacterId,
    setCampaignId,
    setSelectedId,
  });

  useEffect(() => {
    if (!cloudEnabled) {
      setAuthReady(true);
      return;
    }

    let isCancelled = false;

    async function initializeSession() {
      try {
        const session = await getCurrentSession();
        if (isCancelled) return;
        const user = getSessionUser(session);
        setCurrentUserId(user?.id ?? null);

        if (user) {
          await ensureProfileExists();
          const context = await getAccessContext();
          if (isCancelled) return;
          setCurrentUserProfile(context.profile);
          setIsAdmin(Boolean(context.profile?.is_admin));
          setIsGm(Boolean(context.profile?.is_gm));
          setCampaignRolesByCampaignId(context.campaignRolesByCampaignId);
          setCharacterRolesByCharacterId(context.characterRolesByCharacterId);
        }
      } catch (error) {
        console.error("Failed to initialize auth session", error);
      } finally {
        if (!isCancelled) {
          setAuthReady(true);
        }
      }
    }

    void initializeSession();

    const unsubscribe = onAuthStateChange(async (_event, session) => {
      const user = getSessionUser(session);
      setCurrentUserId(user?.id ?? null);
      setAuthError("");

      if (!user) {
        setCurrentUserProfile(null);
        setIsAdmin(false);
        setIsGm(false);
        setCampaignRolesByCampaignId({});
        setCharacterRolesByCharacterId({});
        return;
      }

      try {
        // Ensure profile exists and safely sync email/display_name from auth metadata.
        await ensureProfileExists();
        const context = await getAccessContext();
        setCurrentUserProfile(context.profile);
        setIsAdmin(Boolean(context.profile?.is_admin));
        setIsGm(Boolean(context.profile?.is_gm));
        setCampaignRolesByCampaignId(context.campaignRolesByCampaignId);
        setCharacterRolesByCharacterId(context.characterRolesByCharacterId);
      } catch (error) {
        console.error("Failed to refresh auth access context", error);
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [cloudEnabled]);

  async function handleEmailCodeRequest() {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    try {
      setRememberMePreference(authRememberMe);
      if (authRememberMe) {
        writeRememberedEmail(authEmail.trim());
      } else {
        clearRememberedEmail();
      }
      await requestEmailSignIn(authEmail.trim(), authPassword);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    try {
      setRememberMePreference(authRememberMe);
      if (authRememberMe) {
        writeRememberedEmail(authEmail.trim());
      } else {
        clearRememberedEmail();
      }
      await signInWithGoogle();
      // OAuth will redirect, but ensure profile exists when we return
      setAuthMessage("Redirecting to Google sign-in...");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Google sign-in failed";
      const message =
        rawMessage.includes("Unsupported provider") || rawMessage.includes("provider is not enabled")
          ? "Google sign-in is not enabled for this Supabase project yet. Enable Google under Supabase Auth > Providers, then retry."
          : rawMessage;
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      setAuthError("");
      setAuthMessage("");
      setCloudStatus("Signed out");
    } catch (error) {
      console.error("Sign-out failed", error);
    }
  }

  function handleCampaignChange(nextCampaignId: string) {
    applyCampaignChange({
      nextCampaignId,
      gameData,
      characters,
      selectedCharacterId,
      setSelectedCharacterId,
      setRaceId,
      setClassId,
    });
  }

  const {
    wizardOpen,
    wizardStep,
    creationDraft,
    wizardCampaign,
    wizardRace,
    wizardRacesForCampaign,
    wizardClass,
    wizardClassesForCampaign,
    wizardSkills,
    wizardPowers,
    wizardItems,
    wizardSkillChoiceRules,
    wizardPowerChoiceRules,
    wizardItemChoiceRules,
    wizardPointBuyTotal,
    wizardPointBuyRemaining,
    quickstartPanelOpen,
    quickstartMode,
    quickstartLocks,
    quickstartConcepts,
    quickstartWarnings,
    quickstartActive,
    openWizard,
    closeWizard,
    finishWizard,
    nextWizardStep,
    previousWizardStep,
    updateWizardAttributeWithRules,
    toggleWizardSkill,
    toggleWizardPower,
    toggleWizardItem,
    handleWizardCampaignChange,
    handleWizardRaceChange,
    handleWizardClassChange,
    handleWizardAttributeGenerationChange,
    toggleWizardSaveProf,
    handleWizardRollAttributes,
    setWizardName,
    openQuickstartPanel,
    closeQuickstartPanel,
    setQuickstartMode,
    updateQuickstartLocks,
    generateFromQuickstartMode,
    chooseQuickstartConcept,
    rerollConcepts,
    rerollEverything,
    rerollName,
    rerollAttributes,
    rerollSkills,
    editGeneratedCharacterManually,
  } = useCharacterCreation({
    gameData,
    campaignId,
    raceId,
    classId,
    getCampaignName,
    makeDraftFromCampaignClassAndRace,
    makeBaseAttributes,
    applyClassAttributeModifiers,
    onFinishDraft: (draft) => {
      commitCreatedCharacter({
        draft,
        setCharacters,
        onPersistUpsert: persistCharacterUpsert,
      });
    },
  });

  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId]
  );

  const selectedCampaign = selected
    ? gameData.campaigns.find((g) => g.id === selected.campaignId) ?? null
    : null;

  const selectedRace = selected ? getRaceById(gameData, selected.raceId ?? "") ?? null : null;

  const selectedClass = selected ? getClassById(gameData, selected.classId) ?? null : null;

  const filteredCharacters = characters.filter((character) => character.campaignId === campaignId);
  const selectedSkills = selectedCampaign ? sortByName(selectedCampaign.skills) : [];

  const selectedPowers = selectedCampaign ? sortByName(selectedCampaign.powers) : [];

  const selectedItems = selectedCampaign ? sortByName(selectedCampaign.items) : [];

  const labels = selectedCampaign?.labels ?? {
    attributes: "Attributes",
    skills: "Skills",
    attacks: "Attacks",
    powers: "Powers",
    inventory: "Inventory",
    className: "Class",
    level: "Level",
    hp: "HP",
  };

  const currentCampaignContextLabel =
    gameData.campaigns.find((campaign) => campaign.id === campaignId)?.name ?? "Unknown Campaign";

  // Export calls now route through an exporter boundary so new exporters can be added safely.
  const roll20Commands = selected
    ? exportCharacter(selected, gameData, DEFAULT_EXPORTER_ID)
    : { modPayload: "" };

  function getCampaignName(id: string) {
    return gameData.campaigns.find((g) => g.id === id)?.name ?? id;
  }

  function getClassName(id: string) {
    return (getClassById(gameData, id)?.name ?? id) || "Unassigned";
  }

  const updateCharacterRecord = (updated: CharacterRecord) => {
    updateCharacter({
      updated,
      setCharacters,
      onPersistUpsert: persistCharacterUpsert,
    });
  };

  const {
    adminOpen,
    adminAutoFocusCampaignName,
    adminSaveRequestVersion,
    openAdminForCurrentCampaign,
    createCampaignAndOpenAdmin,
    cancelAdmin,
    handleAdminSave: applyAdminSaveLocally,
    handleAdminGameDataChange,
  } = useCampaignAdminSession({
    gameData,
    campaignId,
    selectedId,
    characters,
    setGameData,
    setCampaignId,
    setClassId,
    setSelectedId,
  });

  function openAdminScreen() {
    setSecurityOpen(false);
    openAdminForCurrentCampaign();
  }

  function openNewCampaignAdminScreen() {
    setSecurityOpen(false);
    createCampaignAndOpenAdmin();
  }

  function openAccessManagement() {
    cancelAdmin();
    setSecurityOpen(true);
  }

  function cancelAccessManagement() {
    setSecurityOpen(false);
  }

  const {
    levelUpOpen,
    levelUpApplyPending,
    levelUpSkillSelections,
    levelUpPowerSelections,
    levelUpMissingRowMessage,
    nextLevelProgressionRow,
    availableLevelUpSkills,
    availableLevelUpPowers,
    openLevelUpWizard,
    closeLevelUpWizard,
    toggleLevelUpSkill,
    toggleLevelUpPower,
    applyLevelUp,
  } = useLevelUpWorkflow({
    selected,
    selectedCampaign,
    selectedClass,
    onApplyUpdatedCharacter: updateCharacterRecord,
  });

  const {
    updateAttributeWithRules,
    updateSkillWithRules,
    togglePowerWithRules,
    updatePowerWithRules,
    toggleItemWithRules,
    updateInventoryQuantity,
    addManualItem,
    removeManualItem,
    deleteCharacter,
  } = useCharacterEditor({
    characters,
    selectedId,
    campaignId,
    selectedCampaign,
    updateCharacter: updateCharacterRecord,
    setCharacters,
    setSelectedId,
    onDeleteCharacter: (id) => {
      void persistCharacterDelete(id);
    },
  });

  async function handleAdminSave(nextGameData: GameData) {
    await persistCampaignChanges(gameData, nextGameData);
    applyAdminSaveLocally(nextGameData);
  }

  const selectedWorkspaceCallbacks = useSelectedCharacterWorkspaceCallbacks({
    selected,
    updateCharacter: updateCharacterRecord,
    updateAttributeWithRules,
    updateSkillWithRules,
    togglePowerWithRules,
    updatePowerWithRules,
    toggleItemWithRules,
    updateInventoryQuantity,
    removeManualItem,
    addManualItem,
  });

  async function refreshAccessContextState() {
    try {
      await claimCampaignEmailAccessInvites();
    } catch {
      // Invite claiming is best-effort to keep access fresh after sign-in.
    }
    const context = await getAccessContext();
    setIsAdmin(Boolean(context.profile?.is_admin));
    setIsGm(Boolean(context.profile?.is_gm));
    setCampaignRolesByCampaignId(context.campaignRolesByCampaignId);
    setCharacterRolesByCharacterId(context.characterRolesByCharacterId);
  }

  const currentCampaignRowId = campaignRowIdsByAppId[campaignId] ?? "";
  const hasAnyCampaignAccess = gameData.campaigns.length > 0;
  // UI-only permission hints: these values only control visibility/affordances.
  // Server-side authorization for save/delete/sync is enforced by Supabase RLS.
  const uiCanCreateCampaign = isAdmin || isGm;
  const signedInDisplayName = currentUserProfile?.display_name?.trim() || "";
  const signedInEmail = currentUserProfile?.email?.trim() || "";
  const uiCanEditCurrentCampaign = Boolean(
    isAdmin ||
      isGm ||
      campaignRolesByCampaignId[campaignId] === "editor"
  );
  const uiCanCreateCharacterInCurrentCampaign = Boolean(
    isAdmin ||
      isGm ||
      campaignRolesByCampaignId[campaignId] === "player" ||
      campaignRolesByCampaignId[campaignId] === "editor"
  );
  const uiCanManageUsers = isAdmin;
  const uiCanManageCampaignAccess = Boolean(
    currentCampaignRowId && (isAdmin || campaignRolesByCampaignId[campaignId] === "editor")
  );
  const uiCanManageCharacterAccess = Boolean(
    selected && currentCampaignRowId && (isAdmin || campaignRolesByCampaignId[selected.campaignId] === "editor")
  );
  const uiCanEditCharacterById = (characterId: string) => {
    if (isAdmin) return true;
    const character = characters.find((item) => item.id === characterId);
    if (!character) return false;

    const campaignRole = campaignRolesByCampaignId[character.campaignId];
    if (campaignRole === "editor") return true;

    const directRole = characterRolesByCharacterId[characterId];
    return directRole === "editor";
  };
  const uiCanEditSelectedCharacter = Boolean(selected && uiCanEditCharacterById(selected.id));
  const directCharacterAccessCount = Object.keys(characterRolesByCharacterId).length;
  const userById = new Map(manageableUsers.map((user) => [user.id, user] as const));
  const campaignUserCandidateIds = uiCanManageCampaignAccess
    ? manageableUsers.map((user) => user.id)
    : [];
  const characterUserCandidateIds = uiCanManageCharacterAccess
    ? Array.from(
        new Set(
          isAdmin
            ? manageableUsers.map((user) => user.id)
            : [
                ...campaignAccessRows.map((row) => row.user_id),
                ...characterAccessRows.map((row) => row.user_id),
                currentUserId ?? "",
              ].filter(Boolean)
        )
      )
    : [];

  function getUserLabel(userId: string) {
    const profile = userById.get(userId) ?? null;
    const name = resolveUserName(profile, userId);
    const email = resolveUserEmail(profile, userId);
    return `${name} (${email})`;
  }

  const reloadAccessManagementData = useCallback(async () => {
    if (!currentUserId) return;

    if (uiCanManageUsers || uiCanManageCampaignAccess) {
      try {
        const users = await listManageableProfiles();
        setManageableUsers(users);
      } catch (error) {
        if (uiCanManageUsers) {
          throw error;
        }
        // Some environments restrict profile lookups for non-admins.
        setManageableUsers([]);
      }
    } else {
      setManageableUsers([]);
    }

    if (currentCampaignRowId && (uiCanManageCampaignAccess || uiCanManageCharacterAccess)) {
      const campaignRows = await listCampaignAccessRows(currentCampaignRowId);
      setCampaignAccessRows(campaignRows);
    } else {
      setCampaignAccessRows([]);
    }

    if (uiCanManageCharacterAccess && selected) {
      const rows = await listCharacterAccessRows(selected.id);
      setCharacterAccessRows(rows);
    } else {
      setCharacterAccessRows([]);
    }
  }, [
    uiCanManageUsers,
    uiCanManageCampaignAccess,
    uiCanManageCharacterAccess,
    currentCampaignRowId,
    currentUserId,
    selected,
  ])

  useEffect(() => {
    if (!currentUserId) return;
    let isCancelled = false;

    async function load() {
      try {
        await reloadAccessManagementData();
      } catch (error) {
        if (isCancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load access management data";
        setAccessManagementError(message);
      }
    }

    void load();
    return () => {
      isCancelled = true;
    };
  }, [currentUserId, reloadAccessManagementData]);

  async function runAccessMutation(action: () => Promise<void>) {
    setAccessManagementError("");
    try {
      await action();
      await refreshAccessContextState();
      await reloadAccessManagementData();
      return { ok: true as const };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Access management action failed";
      const message = formatAccessManagementError(rawMessage);
      setAccessManagementError(message);
      return { ok: false as const, message };
    }
  }

  function formatAccessManagementError(rawMessage: string) {
    const text = rawMessage.toLowerCase();

    if (text.includes("row-level security") || text.includes("rls") || text.includes("permission denied")) {
      if (text.includes("profiles")) {
        return "You do not have access to the full people list in this environment. Ask an admin to add this person for you.";
      }
      if (text.includes("campaign_user_access")) {
        return "You do not have permission to update campaign members for this campaign.";
      }
      return "This action is not allowed for your current account permissions.";
    }

    return rawMessage;
  }

  async function handleSaveUserRoles(input: { userId: string; isAdmin: boolean; isGm: boolean }) {
    await runAccessMutation(async () => {
      await updateUserRoles({
        userId: input.userId,
        isAdmin: input.isAdmin,
        isGm: input.isGm,
      });
    });
  }

  async function handleDeleteUser(input: { userId: string }) {
    const profile = manageableUsers.find((user) => user.id === input.userId) ?? null;
    if (!profile) {
      setAccessManagementError("Select a valid user first.");
      return;
    }
    if (input.userId === currentUserId) {
      setAccessManagementError("You cannot delete your own user account from this panel.");
      return;
    }

    await runAccessMutation(async () => {
      await deleteUserAccount(input.userId);
    });
  }

  async function handleCreatePlayer(input: {
    displayName: string;
    email: string;
    temporaryPassword: string;
    isAdmin: boolean;
    isGm: boolean;
  }) {
    let successMessage = "Player created successfully.";

    const result = await runAccessMutation(async () => {
      const session = await getCurrentSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("You must be signed in to add players.");
      }

      const response = await fetch("/api/admin-create-player", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          displayName: input.displayName,
          email: input.email,
          temporaryPassword: input.temporaryPassword,
          isAdmin: input.isAdmin,
          isGm: input.isGm,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to create player.");
      }

      if (payload?.message) {
        successMessage = payload.message;
      }
    });

    if (result.ok) {
      return { ok: true as const, message: successMessage };
    }

    return { ok: false as const, message: result.message };
  }

  async function handleAssignCampaignAccess(input: { userId: string; role: "player" | "editor" }) {
    if (!currentCampaignRowId) return;
    await runAccessMutation(async () => {
      await upsertCampaignAccessRow({
        campaignRowId: currentCampaignRowId,
        userId: input.userId,
        role: input.role,
      });
    });
  }

  async function handleAssignCampaignAccessByEmail(input: { email: string; role: "player" | "editor" }) {
    if (!currentCampaignRowId) {
      return { deferred: false as const, message: "Campaign is not selected." };
    }

    let deferred = false;
    await runAccessMutation(async () => {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error("Enter an email address.");
      }

      const profile = await getProfileByEmail(normalizedEmail);
      if (profile) {
        await upsertCampaignAccessRow({
          campaignRowId: currentCampaignRowId,
          userId: profile.id,
          role: input.role,
        });
        return;
      }

      deferred = true;
      await upsertCampaignAccessInviteByEmail({
        campaignRowId: currentCampaignRowId,
        email: normalizedEmail,
        role: input.role,
      });
    });

    if (deferred) {
      return {
        deferred: true as const,
        message: "User will get access after they sign in.",
      };
    }

    return {
      deferred: false as const,
      message: "Campaign member added.",
    };
  }

  async function handleUpdateCampaignAccess(input: { userId: string; role: "player" | "editor" }) {
    await handleAssignCampaignAccess(input);
  }

  async function handleRemoveCampaignAccess(userId: string) {
    if (!currentCampaignRowId) return;
    await runAccessMutation(async () => {
      await deleteCampaignAccessRow({
        campaignRowId: currentCampaignRowId,
        userId,
        isAdmin,
      });
    });
  }

  async function handleAssignCharacterAccess(input: { userId: string; role: "viewer" | "editor" }) {
    if (!selected) return;
    await runAccessMutation(async () => {
      await upsertCharacterAccessRow({
        characterId: selected.id,
        userId: input.userId,
        role: input.role,
      });
    });
  }

  async function handleUpdateCharacterAccess(input: { userId: string; role: "viewer" | "editor" }) {
    await handleAssignCharacterAccess(input);
  }

  async function handleRemoveCharacterAccess(userId: string) {
    if (!selected) return;
    await runAccessMutation(async () => {
      await deleteCharacterAccessRow({
        characterId: selected.id,
        userId,
      });
    });
  }

  useEffect(() => {
    if (adminOpen && !uiCanEditCurrentCampaign) {
      cancelAdmin();
    }
  }, [adminOpen, uiCanEditCurrentCampaign, cancelAdmin]);



  useEffect(() => {
    if (securityOpen && !uiCanManageUsers && !uiCanManageCampaignAccess && !uiCanManageCharacterAccess) {
      setSecurityOpen(false);
    }
  }, [securityOpen, uiCanManageUsers, uiCanManageCampaignAccess, uiCanManageCharacterAccess]);

  if (!cloudEnabled) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 760 }}>
          <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Supabase Configuration Required</h2>
          <p style={{ marginBottom: 0, ...mutedTextStyle }}>
            This app is configured for Supabase-only persistence. Set <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> to continue.
          </p>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 760 }}>
          <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Loading Session</h2>
          <p style={{ marginBottom: 0, ...mutedTextStyle }}>Checking Supabase authentication session...</p>
        </div>
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 520 }}>
          {useEmailFallback ? (
            <>
              <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Email Sign In</h2>
              <p style={{ ...mutedTextStyle }}>
                Enter your email and password to sign in.
              </p>

              <label style={{ display: "block", marginBottom: 10, fontWeight: 600, color: "var(--cb-muted-label)" }}>
                Email
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => {
                    setAuthEmail(e.target.value);
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  autoComplete="email"
                  className="form-control"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "block", marginBottom: 10, fontWeight: 600, color: "var(--cb-muted-label)" }}>
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => {
                    setAuthPassword(e.target.value);
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  autoComplete="current-password"
                  className="form-control"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--cb-muted-label)", fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={authRememberMe}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAuthRememberMe(checked);
                    setRememberMePreference(checked);
                    if (!checked) {
                      clearRememberedEmail();
                    }
                  }}
                />
                Remember me on this device
              </label>

              {authError ? (
                <div style={{ marginBottom: 12, color: "var(--cb-danger-text)", fontWeight: 600 }}>{authError}</div>
              ) : null}

              {authMessage ? (
                <div style={{ marginBottom: 12, color: "var(--cb-success-text)", fontWeight: 600 }}>{authMessage}</div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <button
                  onClick={() => void handleEmailCodeRequest()}
                  className="button-control"
                  style={primaryButtonStyle}
                  disabled={authLoading || !authEmail.trim() || authPassword.length === 0}
                >
                  {authLoading ? "Signing in..." : "Sign In"}
                </button>
                <button
                  onClick={() => setUseEmailFallback(false)}
                  className="button-control"
                  style={buttonStyle}
                >
                  Back to Google Sign In
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Character Builder</h2>
              <p style={{ ...mutedTextStyle }}>
                Sign in with Google to get started.
              </p>

              {authError ? (
                <div style={{ marginBottom: 12, color: "var(--cb-danger-text)", fontWeight: 600 }}>{authError}</div>
              ) : null}

              {authMessage ? (
                <div style={{ marginBottom: 12, color: "var(--cb-success-text)", fontWeight: 600 }}>{authMessage}</div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <button
                  onClick={() => void handleGoogleSignIn()}
                  className="button-control"
                  style={primaryButtonStyle}
                  disabled={authLoading}
                >
                  {authLoading ? "Signing in..." : "Continue with Google"}
                </button>
                <button
                  onClick={() => setUseEmailFallback(true)}
                  className="button-control"
                  style={buttonStyle}
                >
                  Sign In with Email Instead
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Show friendly no-access state for signed-in players with no campaign access
  if (cloudLoadComplete && currentUserId && currentUserProfile && !isAdmin && !isGm && !hasAnyCampaignAccess) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 520 }}>
          <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Welcome!</h2>
          <p style={{ ...mutedTextStyle, marginBottom: 12 }}>
            You're signed in, but you don't have access to any campaigns yet. Ask your GM to add you.
          </p>
          {signedInDisplayName ? (
            <p style={{ ...mutedTextStyle, marginBottom: signedInEmail ? 6 : 16 }}>
              <strong>{signedInDisplayName}</strong>
            </p>
          ) : null}
          {signedInEmail ? (
            <p style={{ ...mutedTextStyle, marginBottom: 16 }}>
              {signedInEmail}
            </p>
          ) : null}
          <button
            onClick={() => void handleSignOut()}
            className="button-control"
            style={buttonStyle}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div
        className="app-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontSize: 56,
            lineHeight: 1.05,
            margin: 0,
            color: "var(--cb-text)",
          }}
        >
          Character Builder
        </h1>

        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          <DisplaySettings
            theme={displayPreferences.theme}
            textSize={displayPreferences.textSize}
            density={displayPreferences.density}
            onThemeChange={(theme) => setDisplayPreferences((prev) => ({ ...prev, theme }))}
            onTextSizeChange={(textSize) => setDisplayPreferences((prev) => ({ ...prev, textSize }))}
            onDensityChange={(density) => setDisplayPreferences((prev) => ({ ...prev, density }))}
          />

          {adminOpen ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={cancelAdmin} className="button-control" style={buttonStyle}>
                Close
              </button>
            </div>
          ) : securityOpen ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={cancelAccessManagement} className="button-control" style={buttonStyle}>
                Close
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {uiCanCreateCampaign ? (
                <button onClick={openNewCampaignAdminScreen} className="button-control" style={primaryButtonStyle}>
                  New Campaign
                </button>
              ) : null}
              {uiCanEditCurrentCampaign ? (
                <button onClick={openAdminScreen} className="button-control" style={buttonStyle}>
                  Edit Campaign
                </button>
              ) : null}
              {(uiCanManageUsers || uiCanManageCampaignAccess || uiCanManageCharacterAccess) ? (
                <button onClick={openAccessManagement} className="button-control" style={buttonStyle}>
                  Access
                </button>
              ) : null}
              <button onClick={() => void handleSignOut()} className="button-control" style={buttonStyle}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {!securityOpen ? (
        <div
        style={{
          marginBottom: 20,
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid var(--cb-border-strong)",
          background: "linear-gradient(135deg, var(--cb-accent-soft), var(--cb-surface))",
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 12,
          alignItems: "end",
        }}
        className="camp-bar"
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--cb-text-muted)",
              letterSpacing: "0.04em",
              fontWeight: 700,
            }}
          >
            CURRENT CAMPAIGN
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 34,
              lineHeight: 1.08,
              fontWeight: 800,
              color: "var(--cb-text)",
            }}
          >
            {currentCampaignContextLabel}
          </div>
        </div>

        <label style={{ display: "block", fontWeight: 600, color: "var(--cb-muted-label)" }}>
          Switch Campaign
          <select className="form-control" value={campaignId} onChange={(e) => handleCampaignChange(e.target.value)} style={inputStyle}>
            {gameData.campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--cb-text-muted)", fontWeight: 500 }}>
            {cloudStatus}
            {directCharacterAccessCount > 0 ? ` • ${directCharacterAccessCount} direct character assignments` : ""}
          </div>
        </label>
        </div>
      ) : null}

      {securityOpen ? (
        <AccessManagementPanel
          canManageUsers={uiCanManageUsers}
          canManageCampaignAccess={uiCanManageCampaignAccess}
          canManageCharacterAccess={uiCanManageCharacterAccess}
          campaignName={currentCampaignContextLabel}
          characterName={selected?.identity.name?.trim() || null}
          users={manageableUsers}
          campaignAccessRows={campaignAccessRows}
          characterAccessRows={characterAccessRows}
          campaignUserCandidateIds={campaignUserCandidateIds}
          characterUserCandidateIds={characterUserCandidateIds}
          getUserLabel={getUserLabel}
          onSaveUserRoles={handleSaveUserRoles}
          onDeleteUser={handleDeleteUser}
          onCreatePlayer={handleCreatePlayer}
          onAssignCampaignAccess={handleAssignCampaignAccess}
          onAssignCampaignAccessByEmail={handleAssignCampaignAccessByEmail}
          onUpdateCampaignAccess={handleUpdateCampaignAccess}
          onRemoveCampaignAccess={handleRemoveCampaignAccess}
          onAssignCharacterAccess={handleAssignCharacterAccess}
          onUpdateCharacterAccess={handleUpdateCharacterAccess}
          onRemoveCharacterAccess={handleRemoveCharacterAccess}
          errorMessage={accessManagementError}
          onClearError={() => setAccessManagementError("")}
        />
      ) : null}

      {adminOpen ? (
        <AdminScreen
          gameData={gameData}
          activeCampaignId={campaignId}
          autoFocusCampaignName={adminAutoFocusCampaignName}
          saveRequestVersion={adminSaveRequestVersion}
          onCampaignContextChange={handleCampaignChange}
          onGameDataChange={handleAdminGameDataChange}
          onSave={handleAdminSave}
        />
      ) : !securityOpen ? (
        <div className="app-body" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <Sidebar
            characters={filteredCharacters}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={() => {
              if (uiCanCreateCharacterInCurrentCampaign) {
                openWizard();
              }
            }}
            onDelete={deleteCharacter}
            canCreate={uiCanCreateCharacterInCurrentCampaign}
            canDeleteCharacter={uiCanEditCharacterById}
            getCampaignName={getCampaignName}
            getClassName={getClassName}
          />

          {wizardOpen && creationDraft ? (
            <div style={{ flex: 1 }}>
              <CharacterCreationWizard
                step={wizardStep}
                draft={creationDraft}
                campaigns={gameData.campaigns}
                racesForCampaign={wizardRacesForCampaign}
                classesForCampaign={wizardClassesForCampaign}
                selectedCampaign={wizardCampaign}
                selectedRace={wizardRace}
                selectedClass={wizardClass}
                skills={wizardSkills}
                powers={wizardPowers}
                items={wizardItems}
                skillChoiceRules={wizardSkillChoiceRules}
                powerChoiceRules={wizardPowerChoiceRules}
                itemChoiceRules={wizardItemChoiceRules}
                pointBuyTotal={wizardPointBuyTotal}
                pointBuyRemaining={wizardPointBuyRemaining}
                labels={
                  wizardCampaign?.labels ?? {
                    attributes: "Attributes",
                    skills: "Skills",
                    attacks: "Attacks",
                    powers: "Powers",
                    inventory: "Inventory",
                    className: "Class",
                    level: "Level",
                    hp: "HP",
                  }
                }
                onNameChange={setWizardName}
                onCampaignChange={handleWizardCampaignChange}
                onRaceChange={handleWizardRaceChange}
                onClassChange={handleWizardClassChange}
                onAttributeGenerationChange={handleWizardAttributeGenerationChange}
                onAttributeChange={(key, value) => updateWizardAttributeWithRules(key, value)}
                onSaveProfToggle={toggleWizardSaveProf}
                onRollAttributes={handleWizardRollAttributes}
                onSkillToggle={toggleWizardSkill}
                onPowerToggle={toggleWizardPower}
                onItemToggle={toggleWizardItem}
                onBack={previousWizardStep}
                onNext={nextWizardStep}
                onCancel={closeWizard}
                onFinish={finishWizard}
                quickstartPanelOpen={quickstartPanelOpen}
                quickstartMode={quickstartMode}
                quickstartLocks={quickstartLocks}
                quickstartConcepts={quickstartConcepts}
                quickstartWarnings={quickstartWarnings}
                quickstartActive={quickstartActive}
                onOpenQuickstart={openQuickstartPanel}
                onCloseQuickstart={closeQuickstartPanel}
                onQuickstartModeChange={setQuickstartMode}
                onQuickstartLocksChange={updateQuickstartLocks}
                onQuickstartGenerate={generateFromQuickstartMode}
                onQuickstartChooseConcept={chooseQuickstartConcept}
                onQuickstartRerollConcepts={rerollConcepts}
                onQuickstartRerollEverything={rerollEverything}
                onQuickstartRerollName={rerollName}
                onQuickstartRerollAttributes={rerollAttributes}
                onQuickstartRerollSkills={rerollSkills}
                onQuickstartEditManually={editGeneratedCharacterManually}
              />
            </div>
          ) : !selected || !selectedCampaign ? (
            <div
              style={{
                ...panelStyle,
                flex: 1,
              }}
            >
              <p style={{ margin: 0, ...mutedTextStyle }}>
                Select a character from the sidebar, or create a new one to get started.
              </p>
            </div>
          ) : (
            <SelectedCharacterWorkspace
              character={selected}
              readOnly={!uiCanEditSelectedCharacter}
              selectedCampaignName={selectedCampaign.name}
              selectedRaceName={selectedRace?.name ?? "Unassigned"}
              selectedClassName={selectedClass?.name ?? "Unassigned"}
              labels={labels}
              selectedSkills={selectedSkills}
              selectedPowers={selectedPowers}
              selectedItems={selectedItems}
              roll20ModPayload={roll20Commands.modPayload}
              levelUpOpen={levelUpOpen && Boolean(selectedClass) && uiCanEditSelectedCharacter}
              levelUpApplyPending={levelUpApplyPending}
              levelUpSkillSelections={levelUpSkillSelections}
              levelUpPowerSelections={levelUpPowerSelections}
              levelUpMissingRowMessage={levelUpMissingRowMessage}
              nextLevel={selected.level + 1}
              nextHitDiceGained={nextLevelProgressionRow?.hitDiceGained ?? 0}
              nextAttributeBonuses={nextLevelProgressionRow?.attributeBonuses ?? []}
              nextNewSkillChoices={nextLevelProgressionRow?.newSkillChoices ?? 0}
              nextNewPowerChoices={nextLevelProgressionRow?.newPowerChoices ?? 0}
              nextProficiencyBonus={nextLevelProgressionRow?.proficiencyBonus}
              availableLevelUpSkills={availableLevelUpSkills}
              availableLevelUpPowers={availableLevelUpPowers}
              onOpenLevelUpWizard={() => {
                if (uiCanEditSelectedCharacter) {
                  openLevelUpWizard();
                }
              }}
              onToggleLevelUpSkill={toggleLevelUpSkill}
              onToggleLevelUpPower={toggleLevelUpPower}
              onCloseLevelUpWizard={closeLevelUpWizard}
              onApplyLevelUp={() => {
                if (uiCanEditSelectedCharacter) {
                  applyLevelUp();
                }
              }}
              canManageCharacterAccess={uiCanManageCharacterAccess}
              characterAccessUsers={manageableUsers}
              campaignAccessRows={campaignAccessRows}
              characterAccessRows={characterAccessRows}
              characterUserCandidateIds={characterUserCandidateIds}
              getUserLabel={getUserLabel}
              onAssignCharacterAccess={handleAssignCharacterAccess}
              onUpdateCharacterAccess={handleUpdateCharacterAccess}
              onRemoveCharacterAccess={handleRemoveCharacterAccess}
              characterAccessErrorMessage={accessManagementError}
              onClearCharacterAccessError={() => setAccessManagementError("")}
              {...selectedWorkspaceCallbacks}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}