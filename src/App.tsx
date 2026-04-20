import { useEffect, useMemo, useRef, useState } from "react";
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
  deleteCampaignById,
  deleteCharacterRow,
  listAllCharacterRows,
  listCampaignRows,
  upsertCampaignBySlug,
  upsertCharacterRow,
} from "./lib/cloudRepository";
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
  const [gameData, setGameData] = useState<GameData>(() => seedGameData);
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [campaignId, setCampaignId] = useState(() => seedGameData.campaigns[0]?.id ?? "");
  const [raceId, setRaceId] = useState("");
  const [classId, setClassId] = useState("");
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudStatus, setCloudStatus] = useState(
    cloudEnabled ? "Connecting to cloud..." : "Supabase configuration missing"
  );
  const [campaignRowIdsByAppId, setCampaignRowIdsByAppId] = useState<Record<string, string>>({});
  const cloudInitDoneRef = useRef(false);

  useEffect(() => {
    if (!cloudEnabled || cloudInitDoneRef.current) return;

    let isCancelled = false;
    // Snapshot seed campaigns once for bootstrap — effect intentionally runs only on mount.
    const seedCampaigns = gameData.campaigns;

    async function initializeCloud() {
      try {
        setCloudStatus("Syncing from cloud...");

        let campaignRows = await listCampaignRows();

        // First run bootstrap: seed cloud from built-in campaign definitions.
        if (campaignRows.length === 0) {
          for (const campaign of seedCampaigns) {
            await upsertCampaignBySlug({
              slug: campaign.id,
              name: campaign.name,
              campaign,
            });
          }
          campaignRows = await listCampaignRows();
        }

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

          const characterRows = await listAllCharacterRows();
          if (isCancelled) return;

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

        setCloudStatus("Cloud sync active");
      } catch (error) {
        console.error("Failed to initialize cloud sync", error);
        if (!isCancelled) {
          setCloudStatus("Cloud unavailable");
        }
      } finally {
        if (!isCancelled) {
          cloudInitDoneRef.current = true;
          setCloudReady(true);
        }
      }
    }

    void initializeCloud();

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudEnabled]); // intentionally run once on mount — no gameData.campaigns dep

  useEffect(() => {
    if (!cloudEnabled || !cloudReady) return;

    let isCancelled = false;

    async function syncCampaignsToCloud() {
      try {
        const existingRows = await listCampaignRows();
        const expectedSlugs = new Set(gameData.campaigns.map((campaign) => campaign.id));
        const nextCampaignMap: Record<string, string> = {};

        for (const campaign of gameData.campaigns) {
          const row = await upsertCampaignBySlug({
            slug: campaign.id,
            name: campaign.name,
            campaign,
          });
          nextCampaignMap[campaign.id] = row.id;
        }

        for (const row of existingRows) {
          if (!expectedSlugs.has(row.slug)) {
            await deleteCampaignById(row.id);
          }
        }

        if (!isCancelled) {
          setCampaignRowIdsByAppId(nextCampaignMap);
          setCloudStatus("Cloud sync active");
        }
      } catch (error) {
        console.error("Failed to sync campaigns to cloud", error);
        if (!isCancelled) {
          setCloudStatus("Cloud campaign sync failed (see console)");
        }
      }
    }

    void syncCampaignsToCloud();

    return () => {
      isCancelled = true;
    };
  }, [cloudEnabled, cloudReady, gameData]);

  useEffect(() => {
    if (!cloudEnabled || !cloudReady) return;

    const knownCampaignRowIds = new Set(Object.values(campaignRowIdsByAppId));
    if (knownCampaignRowIds.size === 0) return;

    let isCancelled = false;

    async function syncCharactersToCloud() {
      try {
        const syncStartedAt = Date.now();
        const remoteBeforeSync = await listAllCharacterRows();
        const remoteById = new Map(remoteBeforeSync.map((row) => [row.id, row]));
        let conflictCount = 0;

        for (const character of characters) {
          const campaignRowId = campaignRowIdsByAppId[character.campaignId];
          if (!campaignRowId) continue;

          const remoteRow = remoteById.get(character.id);
          if (remoteRow) {
            const remoteUpdatedAt = Date.parse(
              remoteRow.data?.updatedAt ?? remoteRow.updated_at ?? ""
            );
            const localUpdatedAt = Date.parse(character.updatedAt ?? "");

            if (
              Number.isFinite(remoteUpdatedAt) &&
              Number.isFinite(localUpdatedAt) &&
              remoteUpdatedAt > localUpdatedAt
            ) {
              conflictCount += 1;
              continue;
            }
          }

          await upsertCharacterRow({
            campaignId: campaignRowId,
            character,
          });
        }

        const remoteRows = await listAllCharacterRows();
        const localCharacterIds = new Set(characters.map((character) => character.id));

        if (conflictCount > 0) {
          if (!isCancelled) {
            setCloudStatus(
              `Cloud sync conflict detected for ${conflictCount} character${conflictCount === 1 ? "" : "s"}; remote kept`
            );
          }
          return;
        }

        for (const row of remoteRows) {
          const remoteUpdatedAt = Date.parse(row.data?.updatedAt ?? row.updated_at ?? "");
          const updatedAfterSyncStarted =
            Number.isFinite(remoteUpdatedAt) && remoteUpdatedAt > syncStartedAt;

          if (
            knownCampaignRowIds.has(row.campaign_id) &&
            !localCharacterIds.has(row.id) &&
            !updatedAfterSyncStarted
          ) {
            await deleteCharacterRow(row.id);
          }
        }

        if (!isCancelled) {
          setCloudStatus("Cloud sync active");
        }
      } catch (error) {
        console.error("Failed to sync characters to cloud", error);
        if (!isCancelled) {
          setCloudStatus("Cloud character sync failed (see console)");
        }
      }
    }

    void syncCharactersToCloud();

    return () => {
      isCancelled = true;
    };
  }, [campaignRowIdsByAppId, characters, cloudEnabled, cloudReady]);

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
    setCharacters((prev) =>
      prev.map((c) => (c.id === updated.id ? touchCharacter(updated) : c))
    );
  }

  const {
    adminOpen,
    adminAutoFocusCampaignName,
    adminSaveRequestVersion,
    openAdminForCurrentCampaign,
    createCampaignAndOpenAdmin,
    cancelAdmin,
    requestAdminSave,
    handleAdminSave,
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
  });

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
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={openAdminForCurrentCampaign} style={buttonStyle} disabled={!campaignId}>
              Edit Campaign
            </button>
            <button onClick={createCampaignAndOpenAdmin} style={primaryButtonStyle}>
              New Campaign
            </button>
          </div>
        )}
      </div>

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
          </div>
        </label>
      </div>

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
      ) : (
        <div className="app-body" style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <Sidebar
            characters={filteredCharacters}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={openWizard}
            onDelete={deleteCharacter}
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
              selectedCampaignName={selectedCampaign.name}
              selectedRaceName={selectedRace?.name ?? "Unassigned"}
              selectedClassName={selectedClass?.name ?? "Unassigned"}
              labels={labels}
              selectedSkills={selectedSkills}
              selectedPowers={selectedPowers}
              selectedItems={selectedItems}
              roll20ModPayload={roll20Commands.modPayload}
              levelUpOpen={levelUpOpen && Boolean(selectedClass)}
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
              onOpenLevelUpWizard={openLevelUpWizard}
              onToggleLevelUpSkill={toggleLevelUpSkill}
              onToggleLevelUpPower={toggleLevelUpPower}
              onCloseLevelUpWizard={closeLevelUpWizard}
              onApplyLevelUp={applyLevelUp}
              {...selectedWorkspaceCallbacks}
            />
          )}
        </div>
      )}
    </div>
  );
}