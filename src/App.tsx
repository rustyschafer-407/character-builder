import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createGameData, gameData as seedGameData } from "./data/gameData";
import {
  createCharacterFromCampaignAndClass,
  generateId,
  getAttributeModifier,
  getClassById,
  getClassesForCampaignAndRace,
  getRaceById,
  getRacesForCampaign,
  makeBaseAttributes,
  sortByName,
  touchCharacter,
} from "./lib/character";
import { makePointBuyBaseAttributes } from "./lib/pointBuy";
import {
  getFirstVisibleCharacterId,
} from "./lib/campaigns";
import { DEFAULT_EXPORTER_ID, exportCharacter } from "./lib/exporters";
import {
  type CampaignAccessRow,
  type ProfileRow,
  type CharacterAccessRow,
  deleteCampaignById,
  deleteCampaignAccessRow,
  deleteCharacterAccessRow,
  deleteCharacterRow,
  getAccessContext,
  getCurrentProfile,
  ensureProfileExists,
  getProfileByEmail,
  deleteUserAccount,
  listCampaignAccessRows,
  listCharacterAccessRows,
  listManageableProfiles,
  listAccessibleCampaignRows,
  listAccessibleCharacterRows,
  upsertCampaignAccessRow,
  upsertCharacterAccessRow,
  upsertCampaignBySlug,
  upsertCharacterRow,
} from "./lib/cloudRepository";
import {
  getCurrentSession,
  getSessionUser,
  onAuthStateChange,
  requestEmailSignIn,
  signInWithGoogle,
  syncProfileFromAuth,
  signOut,
} from "./lib/authRepository";
import { hasSupabaseEnv } from "./lib/supabaseClient";
import type { CharacterRecord } from "./types/character";
import type {
  AttributeKey,
  CampaignDefinition,
  GameData,
} from "./types/gameData";

import Sidebar from "./components/Sidebar";
import CharacterCreationWizard, {
  type CharacterCreationDraft,
} from "./components/CharacterCreationWizard";
import AdminScreen from "./components/AdminScreen";
import AccessManagementPanel from "./components/AccessManagementPanel";
import SelectedCharacterWorkspace from "./components/SelectedCharacterWorkspace";
import { useCharacterCreation } from "./hooks/useCharacterCreation";
import { useCampaignAdminSession } from "./hooks/useCampaignAdminSession";
import { useCharacterEditor } from "./hooks/useCharacterEditor";
import { useLevelUpWorkflow } from "./hooks/useLevelUpWorkflow";
import { useSelectedCharacterWorkspaceCallbacks } from "./hooks/useSelectedCharacterWorkspaceCallbacks";
import { buttonStyle, inputStyle, mutedTextStyle, pageStyle, panelStyle, primaryButtonStyle } from "./components/uiStyles";

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

function makeDefaultSheet(): CharacterRecord["sheet"] {
  return {
    speed: "",
    acBase: 10,
    acBonus: 0,
    acUseDex: true,
    initMisc: 0,
    saveProf: {
      STR: false,
      DEX: false,
      CON: false,
      INT: false,
      WIS: false,
      CHA: false,
    },
    saveBonus: {
      STR: 0,
      DEX: 0,
      CON: 0,
      INT: 0,
      WIS: 0,
      CHA: 0,
    },
  };
}

function resolveCloudCampaignId(row: {
  slug: string;
  data: Partial<CampaignDefinition> | null | undefined;
}) {
  const slug = typeof row.slug === "string" ? row.slug.trim() : "";
  if (slug) {
    return slug;
  }

  const dataId =
    row.data && typeof row.data.id === "string" ? row.data.id.trim() : "";
  return dataId;
}

function normalizeCloudCampaignRow(row: {
  slug: string;
  name: string;
  data: CampaignDefinition;
}) {
  if (!row.data || typeof row.data !== "object") {
    return null;
  }

  const campaignId = resolveCloudCampaignId(row);
  if (!campaignId) {
    return null;
  }

  const normalizedName =
    typeof row.data.name === "string" && row.data.name.trim().length > 0
      ? row.data.name
      : row.name || campaignId;

  return {
    ...row.data,
    id: campaignId,
    name: normalizedName,
  } as CampaignDefinition;
}

export default function App() {
  const cloudEnabled = hasSupabaseEnv();
  const [authReady, setAuthReady] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
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
  const [gameData, setGameData] = useState<GameData>(() => seedGameData);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [campaignId, setCampaignId] = useState(() => seedGameData.campaigns[0]?.id ?? "");
  const [raceId, setRaceId] = useState("");
  const [classId, setClassId] = useState("");
  const [cloudStatus, setCloudStatus] = useState(
    cloudEnabled ? "Connecting to cloud..." : "Supabase configuration missing"
  );
  const [campaignRowIdsByAppId, setCampaignRowIdsByAppId] = useState<Record<string, string>>({});
  const [manageableUsers, setManageableUsers] = useState<ProfileRow[]>([]);
  const [campaignAccessRows, setCampaignAccessRows] = useState<CampaignAccessRow[]>([]);
  const [characterAccessRows, setCharacterAccessRows] = useState<CharacterAccessRow[]>([]);
  const [accessManagementError, setAccessManagementError] = useState("");
  const cloudInitDoneRef = useRef(false);

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
      cloudInitDoneRef.current = false;

      if (!user) {
        setCurrentUserProfile(null);
        setIsAdmin(false);
        setIsGm(false);
        setCampaignRolesByCampaignId({});
        setCharacterRolesByCharacterId({});
        return;
      }

      try {
        // Sync profile from auth metadata (updates display_name without overwriting admin/gm)
        await syncProfileFromAuth();
        
        // Ensure profile exists and load access context
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

  useEffect(() => {
    if (!cloudEnabled || !currentUserId || cloudInitDoneRef.current) return;

    let isCancelled = false;
    async function initializeCloud() {
      try {
        setCloudStatus("Loading campaigns and characters...");

        const profile = await getCurrentProfile();
        setIsAdmin(Boolean(profile?.is_admin));
        setIsGm(Boolean(profile?.is_gm));

        const campaignRows = await listAccessibleCampaignRows();

        if (isCancelled) return;

        const normalizedCloudCampaigns = campaignRows
          .map((row) => normalizeCloudCampaignRow(row))
          .filter((row): row is CampaignDefinition => row !== null);

        const nextCampaignMap = Object.fromEntries(
          campaignRows
            .map((row) => [resolveCloudCampaignId(row), row.id] as const)
            .filter(([id]) => Boolean(id))
        );
        setCampaignRowIdsByAppId(nextCampaignMap);

        setCampaignRolesByCampaignId(
          Object.fromEntries(
            campaignRows
              .filter((row) => row.campaign_role)
              .map((row) => [row.id, row.campaign_role] as const)
          ) as Record<string, "player" | "editor">
        );

        if (normalizedCloudCampaigns.length > 0) {
          const nextGameData = createGameData({
            campaigns: normalizedCloudCampaigns,
          });

          setGameData(nextGameData);
          setCampaignId((current) =>
            nextGameData.campaigns.some((campaign) => campaign.id === current)
              ? current
              : nextGameData.campaigns[0]?.id ?? ""
          );

          const characterRows = await listAccessibleCharacterRows();
          if (isCancelled) return;

          setCharacterRolesByCharacterId(
            Object.fromEntries(
              characterRows
                .filter((row) => row.character_role)
                .map((row) => [row.id, row.character_role] as const)
            ) as Record<string, "viewer" | "editor">
          );

          const nextCharacters = characterRows
            .map((row) => row.data)
            .map((character) =>
              character.sheet
                ? character
                : {
                    ...character,
                    sheet: makeDefaultSheet(),
                  }
            );

          setCharacters(nextCharacters);
          setSelectedId((current) =>
            nextCharacters.some((character) => character.id === current) ? current : ""
          );
        }

        setCloudStatus("Authenticated cloud access active");
      } catch (error) {
        console.error("Failed to initialize cloud sync", error);
        if (!isCancelled) {
          setCloudStatus("Cloud unavailable");
        }
      } finally {
        if (!isCancelled) {
          cloudInitDoneRef.current = true;
        }
      }
    }

    void initializeCloud();

    return () => {
      isCancelled = true;
    };
  }, [cloudEnabled, currentUserId]); // intentionally run after auth session is present

  async function persistCampaignChanges(previousGameData: GameData, nextGameData: GameData) {
    if (!cloudEnabled || !currentUserId) return;

    try {
      const previousById = new Map(previousGameData.campaigns.map((campaign) => [campaign.id, campaign]));
      const nextById = new Map(nextGameData.campaigns.map((campaign) => [campaign.id, campaign]));
      const nextCampaignMap = { ...campaignRowIdsByAppId };

      for (const [appCampaignId, campaign] of nextById) {
        const previous = previousById.get(appCampaignId);
        const isChanged = !previous || JSON.stringify(previous) !== JSON.stringify(campaign);
        if (!isChanged) continue;

        const row = await upsertCampaignBySlug({
          slug: campaign.id,
          name: campaign.name,
          campaign,
        });
        nextCampaignMap[campaign.id] = row.id;
      }

      for (const [appCampaignId] of previousById) {
        if (!nextById.has(appCampaignId)) {
          const rowId = nextCampaignMap[appCampaignId];
          if (rowId) {
            await deleteCampaignById(rowId);
            delete nextCampaignMap[appCampaignId];
          }
        }
      }

      setCampaignRowIdsByAppId(nextCampaignMap);
      setCloudStatus("Authenticated cloud access active");
    } catch (error) {
      console.error("Failed to persist campaign changes", error);
      setCloudStatus("Campaign save failed (see console)");
    }
  }

  async function persistCharacterUpsert(character: CharacterRecord) {
    if (!cloudEnabled || !currentUserId) return;

    const campaignRowId = campaignRowIdsByAppId[character.campaignId];
    if (!campaignRowId) {
      setCloudStatus("Character save blocked: campaign not yet persisted");
      return;
    }

    try {
      await upsertCharacterRow({
        campaignId: campaignRowId,
        character,
      });
      setCloudStatus("Authenticated cloud access active");
    } catch (error) {
      console.error("Failed to persist character", error);
      setCloudStatus("Character save failed (see console)");
    }
  }

  async function persistCharacterDelete(characterId: string) {
    if (!cloudEnabled || !currentUserId) return;

    try {
      await deleteCharacterRow(characterId);
      setCloudStatus("Authenticated cloud access active");
    } catch (error) {
      console.error("Failed to delete character", error);
      setCloudStatus("Character delete failed (see console)");
    }
  }

  async function handleEmailCodeRequest() {
    setAuthLoading(true);
    setAuthError("");
    setAuthMessage("");
    try {
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
    setCampaignId(nextCampaignId);
    const nextRaceId = getRacesForCampaign(gameData, nextCampaignId)[0]?.id ?? "";
    setRaceId(nextRaceId);
    const nextClassId = getClassesForCampaignAndRace(gameData, nextCampaignId, nextRaceId)[0]?.id ?? "";
    setClassId(nextClassId);

    const currentlyVisible = characters.some(
      (character) =>
        character.id === selectedId && character.campaignId === nextCampaignId
    );

    if (selectedId && !currentlyVisible) {
      setSelectedId(getFirstVisibleCharacterId(characters, nextCampaignId));
    }
  }

  function commitCreatedCharacter(draft: CharacterCreationDraft) {
    const character: CharacterRecord = {
      id: generateId(),
      identity: draft.identity,
      campaignId: draft.campaignId,
      raceId: draft.raceId,
      classId: draft.classId,
      level: draft.level,
      proficiencyBonus: draft.proficiencyBonus,
      attributes: draft.attributes,
      attributeGeneration: draft.attributeGeneration,
      hp: draft.hp,
      sheet: {
        speed: "",
        acBase: 10,
        acBonus: 0,
        acUseDex: true,
        initMisc: 0,
        saveProf: { ...draft.saveProf },
        saveBonus: {
          STR: 0,
          DEX: 0,
          CON: 0,
          INT: 0,
          WIS: 0,
          CHA: 0,
        },
      },
      skills: draft.skills,
      powers: draft.powers,
      inventory: draft.inventory,
      attacks: draft.attacks,
      levelProgression: draft.levelProgression,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCharacters((prev) => [...prev, character]);
    setSelectedId(character.id);
    void persistCharacterUpsert(character);
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
  } = useCharacterCreation({
    gameData,
    campaignId,
    raceId,
    classId,
    getCampaignName,
    makeDraftFromCampaignClassAndRace,
    makeBaseAttributes,
    applyClassAttributeModifiers,
    onFinishDraft: commitCreatedCharacter,
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

  function updateCharacter(updated: CharacterRecord) {
    const touched = touchCharacter(updated);
    setCharacters((prev) =>
      prev.map((c) => (c.id === touched.id ? touched : c))
    );
    void persistCharacterUpsert(touched);
  }

  const {
    adminOpen,
    adminAutoFocusCampaignName,
    adminSaveRequestVersion,
    openAdminForCurrentCampaign,
    createCampaignAndOpenAdmin,
    cancelAdmin,
    requestAdminSave,
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
    onApplyUpdatedCharacter: updateCharacter,
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
    updateCharacter,
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
    updateCharacter,
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
    const context = await getAccessContext();
    setIsAdmin(Boolean(context.profile?.is_admin));
    setIsGm(Boolean(context.profile?.is_gm));
    setCampaignRolesByCampaignId(context.campaignRolesByCampaignId);
    setCharacterRolesByCharacterId(context.characterRolesByCharacterId);
  }

  const currentCampaignRowId = campaignRowIdsByAppId[campaignId] ?? "";
  const hasAnyCampaignAccess = Object.keys(campaignRolesByCampaignId).length > 0;
  const canCreateCampaign = isAdmin || isGm;
  const canEditCurrentCampaign = Boolean(isAdmin || campaignRolesByCampaignId[campaignId] === "editor");
  const canCreateCharacterInCurrentCampaign = Boolean(
    isAdmin ||
      campaignRolesByCampaignId[campaignId] === "player" ||
      campaignRolesByCampaignId[campaignId] === "editor"
  );
  const canManageUsers = isAdmin;
  const canManageCampaignAccess = Boolean(isAdmin && currentCampaignRowId);
  const canManageCharacterAccess = Boolean(
    selected && currentCampaignRowId && (isAdmin || campaignRolesByCampaignId[selected.campaignId] === "editor")
  );
  const canEditCharacterById = (characterId: string) => {
    if (isAdmin) return true;
    const character = characters.find((item) => item.id === characterId);
    if (!character) return false;

    const campaignRole = campaignRolesByCampaignId[character.campaignId];
    if (campaignRole === "editor") return true;

    const directRole = characterRolesByCharacterId[characterId];
    return directRole === "editor";
  };
  const canEditSelectedCharacter = Boolean(selected && canEditCharacterById(selected.id));
  const directCharacterAccessCount = Object.keys(characterRolesByCharacterId).length;
  const userById = new Map(manageableUsers.map((user) => [user.id, user] as const));
  const campaignUserCandidateIds = canManageCampaignAccess
    ? manageableUsers.map((user) => user.id)
    : [];
  const characterUserCandidateIds = canManageCharacterAccess
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
    if (!profile) return userId;
    const name = profile.display_name?.trim();
    if (name) return `${name} (${profile.email ?? userId})`;
    return profile.email ?? userId;
  }

  const reloadAccessManagementData = useCallback(async () => {
    if (!currentUserId) return;

    if (canManageUsers) {
      const users = await listManageableProfiles();
      setManageableUsers(users);
    } else {
      setManageableUsers([]);
    }

    if (currentCampaignRowId && (canManageCampaignAccess || canManageCharacterAccess)) {
      const campaignRows = await listCampaignAccessRows(currentCampaignRowId);
      setCampaignAccessRows(campaignRows);
    } else {
      setCampaignAccessRows([]);
    }

    if (canManageCharacterAccess && selected) {
      const rows = await listCharacterAccessRows(selected.id);
      setCharacterAccessRows(rows);
    } else {
      setCharacterAccessRows([]);
    }
  }, [
    canManageUsers,
    canManageCampaignAccess,
    canManageCharacterAccess,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Access management action failed";
      setAccessManagementError(message);
    }
  }

  async function handleSaveUserRoles() {
    setAccessManagementError(
      "Global role updates are server-only. Use npm run roles:set with SUPABASE_SERVICE_ROLE_KEY in a trusted environment."
    );
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

  async function handleAddPlayerByEmail(input: { email: string; role: "player" | "editor" }) {
    if (!canManageCampaignAccess) return;
    
    await runAccessMutation(async () => {
      const profile = await getProfileByEmail(input.email);
      
      if (!profile) {
        throw new Error(
          `Player with email "${input.email}" not found. They must sign in with Google using this email first.`
        );
      }
      
      // Verify admin/editor can grant requested role
      if (input.role === "editor" && !isAdmin && campaignRolesByCampaignId[campaignId] !== "editor") {
        throw new Error("Only campaign editors and admins can grant editor access.");
      }
      
      // Grant campaign access
      if (!currentCampaignRowId) throw new Error("Campaign ID is missing");
      
      await upsertCampaignAccessRow({
        campaignRowId: currentCampaignRowId,
        userId: profile.id,
        role: input.role,
      });
    });
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
    if (adminOpen && !canEditCurrentCampaign) {
      cancelAdmin();
    }
  }, [adminOpen, canEditCurrentCampaign, cancelAdmin]);



  useEffect(() => {
    if (securityOpen && !canManageUsers && !canManageCampaignAccess && !canManageCharacterAccess) {
      setSecurityOpen(false);
    }
  }, [securityOpen, canManageUsers, canManageCampaignAccess, canManageCharacterAccess]);

  if (!cloudEnabled) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 760 }}>
          <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>Supabase Configuration Required</h2>
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
          <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>Loading Session</h2>
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
              <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>Email Sign In</h2>
              <p style={{ ...mutedTextStyle }}>
                Enter your email and password to sign in.
              </p>

              <label style={{ display: "block", marginBottom: 10, fontWeight: 600, color: "#b9cdf0" }}>
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
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "block", marginBottom: 10, fontWeight: 600, color: "#b9cdf0" }}>
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
                  style={inputStyle}
                />
              </label>

              {authError ? (
                <div style={{ marginBottom: 12, color: "#ff9ea7", fontWeight: 600 }}>{authError}</div>
              ) : null}

              {authMessage ? (
                <div style={{ marginBottom: 12, color: "#9ee7c2", fontWeight: 600 }}>{authMessage}</div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <button
                  onClick={() => void handleEmailCodeRequest()}
                  style={primaryButtonStyle}
                  disabled={authLoading || !authEmail.trim() || authPassword.length === 0}
                >
                  {authLoading ? "Signing in..." : "Sign In"}
                </button>
                <button
                  onClick={() => setUseEmailFallback(false)}
                  style={buttonStyle}
                >
                  Back to Google Sign In
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>Character Builder</h2>
              <p style={{ ...mutedTextStyle }}>
                Sign in with Google to get started.
              </p>

              {authError ? (
                <div style={{ marginBottom: 12, color: "#ff9ea7", fontWeight: 600 }}>{authError}</div>
              ) : null}

              {authMessage ? (
                <div style={{ marginBottom: 12, color: "#9ee7c2", fontWeight: 600 }}>{authMessage}</div>
              ) : null}

              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <button
                  onClick={() => void handleGoogleSignIn()}
                  style={primaryButtonStyle}
                  disabled={authLoading}
                >
                  {authLoading ? "Signing in..." : "Continue with Google"}
                </button>
                <button
                  onClick={() => setUseEmailFallback(true)}
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
  if (currentUserId && !isAdmin && !isGm && !hasAnyCampaignAccess) {
    return (
      <div style={pageStyle}>
        <div style={{ ...panelStyle, maxWidth: 520 }}>
          <h2 style={{ marginTop: 0, color: "var(--text-primary)" }}>Welcome!</h2>
          <p style={{ ...mutedTextStyle }}>
            You're signed in, but you don't have access to any campaigns yet.
          </p>
          {currentUserProfile?.display_name && (
            <p style={{ ...mutedTextStyle, marginBottom: 16 }}>
              <strong>{currentUserProfile.display_name}</strong> ({currentUserProfile.email || "No email"})
            </p>
          )}
          <p style={{ color: "#9ee7c2", fontWeight: 600, marginBottom: 24 }}>
            Ask your GM to add you to a campaign.
          </p>
          <button
            onClick={() => void handleSignOut()}
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
            color: "var(--text-primary)",
          }}
        >
          Character Builder
        </h1>

        {adminOpen ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cancelAdmin} style={buttonStyle}>
              Cancel
            </button>
            <button onClick={requestAdminSave} style={primaryButtonStyle}>
              Save
            </button>
          </div>
        ) : securityOpen ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cancelAccessManagement} style={buttonStyle}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            {canCreateCampaign ? (
              <button onClick={openNewCampaignAdminScreen} style={primaryButtonStyle}>
                New Campaign
              </button>
            ) : null}
            {canEditCurrentCampaign ? (
              <button onClick={openAdminScreen} style={buttonStyle}>
                Edit Campaign
              </button>
            ) : null}
            {(canManageUsers || canManageCampaignAccess || canManageCharacterAccess) ? (
              <button onClick={openAccessManagement} style={buttonStyle}>
                Access
              </button>
            ) : null}
            <button onClick={() => void handleSignOut()} style={buttonStyle}>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {!securityOpen ? (
        <div
        style={{
          marginBottom: 20,
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid rgba(73, 224, 255, 0.45)",
          background: "linear-gradient(135deg, rgba(73, 224, 255, 0.14), rgba(11, 22, 42, 0.72))",
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
              color: "var(--text-secondary)",
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
              color: "var(--text-primary)",
            }}
          >
            {currentCampaignContextLabel}
          </div>
        </div>

        <label style={{ display: "block", fontWeight: 600, color: "#b9cdf0" }}>
          Switch Campaign
          <select value={campaignId} onChange={(e) => handleCampaignChange(e.target.value)} style={inputStyle}>
            {gameData.campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
            {cloudStatus}
            {directCharacterAccessCount > 0 ? ` • ${directCharacterAccessCount} direct character assignments` : ""}
          </div>
        </label>
        </div>
      ) : null}

      {securityOpen ? (
        <AccessManagementPanel
          canManageUsers={canManageUsers}
          canManageCampaignAccess={canManageCampaignAccess}
          canManageCharacterAccess={canManageCharacterAccess}
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
          onAssignCampaignAccess={handleAssignCampaignAccess}
          onAddPlayerByEmail={handleAddPlayerByEmail}
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
              if (canCreateCharacterInCurrentCampaign) {
                openWizard();
              }
            }}
            onDelete={deleteCharacter}
            canCreate={canCreateCharacterInCurrentCampaign}
            canDeleteCharacter={canEditCharacterById}
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
              readOnly={!canEditSelectedCharacter}
              selectedCampaignName={selectedCampaign.name}
              selectedRaceName={selectedRace?.name ?? "Unassigned"}
              selectedClassName={selectedClass?.name ?? "Unassigned"}
              labels={labels}
              selectedSkills={selectedSkills}
              selectedPowers={selectedPowers}
              selectedItems={selectedItems}
              roll20ModPayload={roll20Commands.modPayload}
              levelUpOpen={levelUpOpen && Boolean(selectedClass) && canEditSelectedCharacter}
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
                if (canEditSelectedCharacter) {
                  openLevelUpWizard();
                }
              }}
              onToggleLevelUpSkill={toggleLevelUpSkill}
              onToggleLevelUpPower={toggleLevelUpPower}
              onCloseLevelUpWizard={closeLevelUpWizard}
              onApplyLevelUp={() => {
                if (canEditSelectedCharacter) {
                  applyLevelUp();
                }
              }}
              {...selectedWorkspaceCallbacks}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}