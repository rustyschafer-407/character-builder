import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  deleteUserAccount,
  updateUserRoles,
  claimCampaignEmailAccessInvites,
  listCampaignAccessRows,
  listCharacterAccessRows,
  listLoginPickerProfileSummariesByIds,
  listManageableProfiles,
  upsertCampaignAccessRow,
  upsertCharacterAccessRow,
} from "./lib/cloudRepository";
import {
  getCurrentSession,
  getSessionUser,
  onAuthStateChange,
  requestEmailSignIn,
  requestPasswordReset,
  signInWithGoogle,
  signOut,
  updateCurrentUserPassword,
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

function hasRecoveryContextInLocation() {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  const searchType = searchParams.get("type")?.toLowerCase();
  if (searchType === "recovery") return true;
  if (searchParams.has("code")) return true;

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const hashType = hashParams.get("type")?.toLowerCase();
  if (hashType === "recovery") return true;
  if (hashParams.has("access_token") || hashParams.has("refresh_token")) return true;

  return false;
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
    characterType: base.characterType ?? "pc",
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
  const currentPathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const returnToFromQuery = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("returnTo")?.trim() ?? "";
  }, []);
  const inviteTokenFromQuery = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
  }, []);
  const authActionFromQuery = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("auth")?.trim().toLowerCase() ?? "";
  }, []);
  const inviteRouteActive = currentPathname === "/invite";
  const updatePasswordRouteActive = currentPathname === "/update-password";
  const inviteSignInFlow = inviteRouteActive || returnToFromQuery.startsWith("/invite");
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(() => readDisplayPreferences());
  const [displayOpen, setDisplayOpen] = useState(false);
  const cloudEnabled = hasSupabaseEnv();
  const [authReady, setAuthReady] = useState(false);
  const [authRememberMe, setAuthRememberMe] = useState(() => getRememberMePreference());
  const [authCardMode, setAuthCardMode] = useState<"sign-in" | "reset-request">(() =>
    authActionFromQuery === "reset" ? "reset-request" : "sign-in"
  );
  const [authEmail, setAuthEmail] = useState(() => (getRememberMePreference() ? readRememberedEmail() : ""));
  const [authPassword, setAuthPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [updatePasswordValue, setUpdatePasswordValue] = useState("");
  const [updatePasswordConfirm, setUpdatePasswordConfirm] = useState("");
  const [updatePasswordRecoveryReady, setUpdatePasswordRecoveryReady] = useState(false);
  const [updatePasswordChecked, setUpdatePasswordChecked] = useState(false);
  const [updatePasswordComplete, setUpdatePasswordComplete] = useState(false);
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
  const [inviteAcceptStatus, setInviteAcceptStatus] = useState<"idle" | "accepting" | "success" | "error">("idle");
  const [inviteAcceptError, setInviteAcceptError] = useState("");
  const inviteAcceptanceStartedRef = useRef(false);

  useEffect(() => {
    if (authActionFromQuery !== "reset") return;
    setUseEmailFallback(true);
    setAuthCardMode("reset-request");
  }, [authActionFromQuery]);

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
          try {
            await claimCampaignEmailAccessInvites();
          } catch {
            // Invite claiming is best-effort to keep first-load access current.
          }

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

    const unsubscribe = onAuthStateChange(async (event, session) => {
      const user = getSessionUser(session);
      setCurrentUserId(user?.id ?? null);
      setAuthError("");

      if (event === "PASSWORD_RECOVERY") {
        setUpdatePasswordRecoveryReady(true);
      }

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
        try {
          await claimCampaignEmailAccessInvites();
        } catch {
          // Invite claiming is best-effort to keep first-load access current.
        }

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

  useEffect(() => {
    if (!cloudEnabled || !updatePasswordRouteActive) {
      return;
    }

    let isCancelled = false;

    async function checkRecoverySession() {
      setUpdatePasswordChecked(false);
      try {
        const session = await getCurrentSession();
        if (isCancelled) return;
        const hasRecoveryContext = hasRecoveryContextInLocation();
        setUpdatePasswordRecoveryReady(Boolean(session?.user) && (hasRecoveryContext || updatePasswordRecoveryReady));
      } catch {
        if (isCancelled) return;
        setUpdatePasswordRecoveryReady(false);
      } finally {
        if (!isCancelled) {
          setUpdatePasswordChecked(true);
        }
      }
    }

    void checkRecoverySession();

    return () => {
      isCancelled = true;
    };
  }, [cloudEnabled, updatePasswordRouteActive, updatePasswordRecoveryReady]);

  async function handleEmailPasswordSignIn() {
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

  async function handlePasswordResetRequest() {
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
      setAuthError("Enter your email address.");
      setAuthMessage("");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    try {
      await requestPasswordReset(trimmedEmail);
      setAuthMessage("If an account exists for that email, we sent a password reset link.");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const message =
        rawMessage.includes("rate") || rawMessage.includes("too many")
          ? "You have requested too many reset links. Please wait a bit and try again."
          : "We couldn't send a reset link right now. Please try again.";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleUpdatePasswordSubmit() {
    const nextPassword = updatePasswordValue.trim();
    const confirmPassword = updatePasswordConfirm.trim();

    if (!nextPassword || !confirmPassword) {
      setAuthError("Enter and confirm your new password.");
      setAuthMessage("");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setAuthError("Passwords do not match.");
      setAuthMessage("");
      return;
    }

    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    try {
      await updateCurrentUserPassword(nextPassword);
      await signOut();
      setUpdatePasswordComplete(true);
      setAuthMessage("Password updated. Please sign in.");
      setUpdatePasswordValue("");
      setUpdatePasswordConfirm("");
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message.toLowerCase() : "";
      const message =
        rawMessage.includes("same")
          ? "Choose a different password than your current one."
          : "We couldn't update your password. Request a new reset link and try again.";
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
    setWizardCharacterType,
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

  useEffect(() => {
    if (adminOpen || securityOpen) {
      setDisplayOpen(false);
    }
  }, [adminOpen, securityOpen]);

  function openAdminScreen() {
    setSecurityOpen(false);
    openAdminForCurrentCampaign();
  }

  function openNewCampaignAdminScreen() {
    setSecurityOpen(false);
    createCampaignAndOpenAdmin();
  }

  function openAccessManagement() {
    if (!uiCanOpenAccessManagement) {
      return;
    }

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
  const uiCanOpenAccessManagement = uiCanManageUsers || (!isGm && uiCanManageCampaignAccess);
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

    let users: ProfileRow[] = [];
    let campaignRows: CampaignAccessRow[] = [];
    let characterRows: CharacterAccessRow[] = [];

    if (currentCampaignRowId && (uiCanManageCampaignAccess || uiCanManageCharacterAccess)) {
      campaignRows = await listCampaignAccessRows(currentCampaignRowId);
    }

    if (uiCanManageCharacterAccess && selected) {
      characterRows = await listCharacterAccessRows(selected.id);
    }

    if (uiCanManageUsers || uiCanManageCampaignAccess) {
      try {
        users = await listManageableProfiles();
      } catch (error) {
        if (uiCanManageUsers) {
          throw error;
        }
        // Some environments restrict profile lookups for non-admins.
        users = [];
      }
    }

    if (!uiCanManageUsers && users.length === 0) {
      const fallbackUserIds = Array.from(
        new Set([
          ...campaignRows.map((row) => row.user_id),
          ...characterRows.map((row) => row.user_id),
          currentUserId,
        ])
      );

      if (fallbackUserIds.length > 0) {
        try {
          users = await listLoginPickerProfileSummariesByIds(fallbackUserIds);
        } catch {
          // Keep UUID fallback labels if lookup RPCs are unavailable.
        }
      }
    }

    setManageableUsers(users);
    setCampaignAccessRows(campaignRows);
    setCharacterAccessRows(characterRows);
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

  useEffect(() => {
    if (!authReady || currentUserId || !inviteRouteActive || typeof window === "undefined") {
      return;
    }

    const safeToken = inviteTokenFromQuery ? `?token=${encodeURIComponent(inviteTokenFromQuery)}` : "";
    const returnTo = `/invite${safeToken}`;
    window.location.replace(`/?returnTo=${encodeURIComponent(returnTo)}`);
  }, [authReady, currentUserId, inviteRouteActive, inviteTokenFromQuery]);

  useEffect(() => {
    inviteAcceptanceStartedRef.current = false;
    setInviteAcceptStatus("idle");
    setInviteAcceptError("");
  }, [inviteRouteActive, inviteTokenFromQuery, currentUserId]);

  useEffect(() => {
    if (!authReady || !currentUserId || currentPathname !== "/" || !returnToFromQuery || typeof window === "undefined") {
      return;
    }

    if (!returnToFromQuery.startsWith("/invite")) {
      return;
    }

    window.location.replace(returnToFromQuery);
  }, [authReady, currentPathname, currentUserId, returnToFromQuery]);

  useEffect(() => {
    if (!inviteRouteActive || !authReady || !currentUserId) {
      return;
    }

    if (!inviteTokenFromQuery) {
      setInviteAcceptStatus("error");
      setInviteAcceptError("Invalid token.");
      return;
    }

    if (inviteAcceptanceStartedRef.current) {
      return;
    }
    inviteAcceptanceStartedRef.current = true;

    let cancelled = false;

    async function acceptInvite() {
      setInviteAcceptStatus("accepting");
      setInviteAcceptError("");

      try {
        const session = await getCurrentSession();
        const accessToken = session?.access_token;
        if (!accessToken) {
          throw new Error("You must be signed in to accept an invite.");
        }

        const response = await fetch("/api/campaign-accept-invite", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ token: inviteTokenFromQuery }),
        });

        const payload = (await response.json().catch(() => null)) as
          | { error?: string; errorCode?: string }
          | null;

        if (!response.ok) {
          const code = payload?.errorCode;
          if (code === "expired") {
            throw new Error("This invite has expired");
          }
          if (code === "invalid_token") {
            throw new Error("Invalid token.");
          }
          if (code === "email_mismatch") {
            throw new Error("This invite is for a different email");
          }
          if (code === "used") {
            throw new Error("This invite has already been used");
          }
          throw new Error(payload?.error || "Failed to accept invite.");
        }

        if (cancelled) return;
        setInviteAcceptStatus("success");
        window.location.replace("/");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to accept invite.";
        setInviteAcceptStatus("error");
        setInviteAcceptError(message);
      }
    }

    void acceptInvite();

    return () => {
      cancelled = true;
    };
  }, [authReady, currentUserId, inviteRouteActive, inviteTokenFromQuery]);

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

  async function handleAddCampaignMember(input: { userId: string; role: "player" | "editor" }) {
    await handleAssignCampaignAccess(input);
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
    if (securityOpen && !uiCanOpenAccessManagement) {
      setSecurityOpen(false);
    }
  }, [securityOpen, uiCanOpenAccessManagement]);

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

  if (updatePasswordRouteActive) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 520 }}>
          {!updatePasswordChecked ? (
            <>
              <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Checking reset link</h2>
              <p style={{ ...mutedTextStyle, marginBottom: 0 }}>Verifying your password reset session...</p>
            </>
          ) : updatePasswordComplete ? (
            <>
              <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Choose a new password</h2>
              <p style={{ ...mutedTextStyle, marginBottom: 12 }}>{authMessage || "Password updated. Please sign in."}</p>
              <a href="/" className="button-control" style={{ ...primaryButtonStyle, display: "inline-flex", textDecoration: "none" }}>
                Back to sign in
              </a>
            </>
          ) : !updatePasswordRecoveryReady ? (
            <>
              <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Choose a new password</h2>
              <p style={{ ...mutedTextStyle, marginBottom: 12 }}>
                This password reset link is invalid or expired. Request a new link.
              </p>
              <a href="/?auth=reset" className="button-control" style={{ ...buttonStyle, display: "inline-flex", textDecoration: "none" }}>
                Request reset link
              </a>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Choose a new password</h2>
              <label style={{ display: "block", marginBottom: 10, fontWeight: 600, color: "var(--cb-muted-label)" }}>
                New password
                <input
                  type="password"
                  value={updatePasswordValue}
                  onChange={(e) => {
                    setUpdatePasswordValue(e.target.value);
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  autoComplete="new-password"
                  className="form-control"
                  style={inputStyle}
                />
              </label>
              <label style={{ display: "block", marginBottom: 12, fontWeight: 600, color: "var(--cb-muted-label)" }}>
                Confirm password
                <input
                  type="password"
                  value={updatePasswordConfirm}
                  onChange={(e) => {
                    setUpdatePasswordConfirm(e.target.value);
                    setAuthError("");
                    setAuthMessage("");
                  }}
                  autoComplete="new-password"
                  className="form-control"
                  style={inputStyle}
                />
              </label>

              {authError ? (
                <div style={{ marginBottom: 12, color: "var(--cb-danger-text)", fontWeight: 600 }}>{authError}</div>
              ) : null}

              {authMessage ? (
                <div style={{ marginBottom: 12, color: "var(--cb-success-text)", fontWeight: 600 }}>{authMessage}</div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <button
                  onClick={() => void handleUpdatePasswordSubmit()}
                  className="button-control"
                  style={primaryButtonStyle}
                  disabled={authLoading}
                >
                  {authLoading ? "Saving..." : "Save password"}
                </button>
                <a href="/?auth=reset" className="button-control" style={{ ...buttonStyle, display: "inline-flex", textDecoration: "none" }}>
                  Request a new reset link
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!currentUserId) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 520 }}>
          {inviteSignInFlow ? (
            <div style={{ marginBottom: 12, color: "var(--cb-text-muted)", fontSize: 13, fontWeight: 600 }}>
              Sign in to accept your campaign invite. You will be redirected to the invite automatically after sign-in.
            </div>
          ) : null}
          {useEmailFallback ? (
            <>
              {authCardMode === "reset-request" ? (
                <>
                  <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Reset your password</h2>
                  <p style={{ ...mutedTextStyle }}>
                    Enter your email and we&apos;ll send a link to choose a new password.
                  </p>

                  <label style={{ display: "block", marginBottom: 12, fontWeight: 600, color: "var(--cb-muted-label)" }}>
                    Email
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setAuthError("");
                        setAuthMessage("");
                      }}
                      autoComplete="email"
                      className="form-control"
                      style={inputStyle}
                    />
                  </label>

                  {authError ? (
                    <div style={{ marginBottom: 12, color: "var(--cb-danger-text)", fontWeight: 600 }}>{authError}</div>
                  ) : null}

                  {authMessage ? (
                    <div style={{ marginBottom: 12, color: "var(--cb-success-text)", fontWeight: 600 }}>{authMessage}</div>
                  ) : null}

                  <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                    <button
                      onClick={() => void handlePasswordResetRequest()}
                      className="button-control"
                      style={primaryButtonStyle}
                      disabled={authLoading || resetEmail.trim().length === 0}
                    >
                      {authLoading ? "Sending..." : "Send reset link"}
                    </button>
                    <button
                      onClick={() => {
                        setAuthCardMode("sign-in");
                        setAuthError("");
                        setAuthMessage("");
                      }}
                      className="button-control"
                      style={buttonStyle}
                    >
                      Back to sign in
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Password Sign In</h2>
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

                  <label style={{ display: "block", marginBottom: 4, fontWeight: 600, color: "var(--cb-muted-label)" }}>
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
                  <button
                    onClick={() => {
                      setAuthCardMode("reset-request");
                      setAuthError("");
                      setAuthMessage("");
                    }}
                    type="button"
                    style={{
                      marginBottom: 12,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      color: "var(--cb-text-muted)",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Forgot or change password?
                  </button>

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
                      onClick={() => void handleEmailPasswordSignIn()}
                      className="button-control"
                      style={primaryButtonStyle}
                      disabled={authLoading || !authEmail.trim() || authPassword.length === 0}
                    >
                      {authLoading ? "Signing in..." : "Sign In"}
                    </button>
                    <button
                      onClick={() => {
                        setUseEmailFallback(false);
                        setAuthCardMode("sign-in");
                      }}
                      className="button-control"
                      style={buttonStyle}
                    >
                      Back to Google Sign In
                    </button>
                  </div>
                </>
              )}
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
                  onClick={() => {
                    setUseEmailFallback(true);
                    setAuthCardMode(authActionFromQuery === "reset" ? "reset-request" : "sign-in");
                    setAuthError("");
                    setAuthMessage("");
                  }}
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

  if (inviteRouteActive) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 560 }}>
          <h2 style={{ marginTop: 0, color: "var(--cb-text)" }}>Campaign Invite</h2>
          {inviteAcceptStatus === "accepting" || inviteAcceptStatus === "idle" ? (
            <p style={{ ...mutedTextStyle, marginBottom: 0 }}>Accepting invite...</p>
          ) : null}
          {inviteAcceptStatus === "error" ? (
            <>
              <p style={{ marginBottom: 12, color: "var(--cb-danger-text)", fontWeight: 700 }}>{inviteAcceptError}</p>
              <button
                onClick={() => window.location.replace("/")}
                className="button-control"
                style={buttonStyle}
              >
                Go To App
              </button>
            </>
          ) : null}
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
              {uiCanOpenAccessManagement ? (
                <button onClick={openAccessManagement} className="button-control" style={buttonStyle}>
                  Access
                </button>
              ) : null}
              <button onClick={() => setDisplayOpen(true)} className="button-control" style={buttonStyle}>
                Display
              </button>
              <button onClick={() => void handleSignOut()} className="button-control" style={buttonStyle}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {displayOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--cb-modal-overlay)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 90,
          }}
          onClick={() => setDisplayOpen(false)}
        >
          <div
            style={{
              ...panelStyle,
              width: "min(560px, 96vw)",
              border: "1px solid var(--cb-border-strong)",
              display: "grid",
              gap: 12,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <h2 style={{ ...mutedTextStyle, margin: 0, fontSize: 12, letterSpacing: "0.04em", fontWeight: 700 }}>DISPLAY</h2>
                <div style={{ color: "var(--cb-text)", fontSize: 24, fontWeight: 800 }}>Accessibility & Theme</div>
              </div>
              <button onClick={() => setDisplayOpen(false)} className="button-control" style={buttonStyle}>
                Close
              </button>
            </div>

            <DisplaySettings
              theme={displayPreferences.theme}
              textSize={displayPreferences.textSize}
              density={displayPreferences.density}
              onThemeChange={(theme) => setDisplayPreferences((prev) => ({ ...prev, theme }))}
              onTextSizeChange={(textSize) => setDisplayPreferences((prev) => ({ ...prev, textSize }))}
              onDensityChange={(density) => setDisplayPreferences((prev) => ({ ...prev, density }))}
            />
          </div>
        </div>
      ) : null}

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
          characterUserCandidateIds={characterUserCandidateIds}
          getUserLabel={getUserLabel}
          onSaveUserRoles={handleSaveUserRoles}
          onDeleteUser={handleDeleteUser}
          onCreatePlayer={handleCreatePlayer}
          onAddCampaignMember={handleAddCampaignMember}
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
                onCharacterTypeChange={setWizardCharacterType}
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