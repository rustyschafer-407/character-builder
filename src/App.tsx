import { useEffect, useMemo, useRef, useState } from "react";
import { createGameData, gameData as seedGameData } from "./data/gameData";
import {
  createCharacterFromCampaignAndClass,
  generateId,
  getClassById,
  getClassesForCampaign,
  touchCharacter,
} from "./lib/character";
import {
  getFirstVisibleCharacterId,
} from "./lib/campaigns";
import { buildChatSetAttrPhases } from "./lib/roll20Export";
import {
  deleteCampaignById,
  deleteCharacterRow,
  listAllCharacterRows,
  listCampaignRows,
  upsertCampaignBySlug,
  upsertCharacterRow,
} from "./lib/cloudRepository";
import { hasSupabaseEnv } from "./lib/supabaseClient";
import { appStorage } from "./storage/appStorage";
import type { CharacterRecord } from "./types/character";
import type {
  AttributeKey,
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

const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

function getPointBuyCost(score: number) {
  if (score < 8) return 0;
  if (score > 15) return 999;
  return POINT_BUY_COSTS[score] ?? 999;
}

function getPointBuySpent(attributes: Record<AttributeKey, number>) {
  return (Object.keys(attributes) as AttributeKey[]).reduce(
    (total, key) => total + getPointBuyCost(attributes[key]),
    0
  );
}

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) =>
    a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
  );
}

function makeBaseAttributes(): Record<AttributeKey, number> {
  return {
    STR: 10,
    DEX: 10,
    CON: 10,
    INT: 10,
    WIS: 10,
    CHA: 10,
  };
}

function applyClassAttributeModifiers(
  attributes: Record<AttributeKey, number>,
  cls: { attributeBonuses?: Array<{ attribute: AttributeKey; amount: number }> } | null
) {
  if (!cls) return attributes;
  const next = { ...attributes };
  for (const bonus of cls.attributeBonuses ?? []) {
    next[bonus.attribute] = (next[bonus.attribute] ?? 0) + bonus.amount;
  }
  return next;
}

function getAttributeModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function makeDraftFromCampaignAndClass(
  gameData: GameData,
  campaignId: string,
  classId: string,
  name: string
) {
  const campaign = gameData.campaigns.find((g) => g.id === campaignId);
  const cls = campaign?.classes.find((c) => c.id === classId);
  if (!campaign || !cls) return null;

  const base = createCharacterFromCampaignAndClass(campaign, cls, name);

  const draft: CharacterCreationDraft = {
    identity: base.identity,
    campaignId: base.campaignId,
    classId: base.classId,
    level: base.level,
    proficiencyBonus: base.proficiencyBonus,
    attributes: base.attributes,
    attributeGeneration: base.attributeGeneration,
    hp: base.hp,
    skills: base.skills,
    powers: base.powers,
    inventory: base.inventory,
    attacks: base.attacks,
    levelProgression: base.levelProgression,
  };

  const method = draft.attributeGeneration?.method ?? "manual";
  if (method === "manual") {
    draft.attributes = makeBaseAttributes();
  } else {
    draft.attributes = applyClassAttributeModifiers(makeBaseAttributes(), cls);
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

function loadCharactersWithDefaultSheets(): CharacterRecord[] {
  return appStorage.loadCharacters().map((character) =>
    character.sheet ? character : { ...character, sheet: makeDefaultSheet() }
  );
}

export default function App() {
  const cloudEnabled = hasSupabaseEnv();
  const [gameData, setGameData] = useState<GameData>(() => appStorage.loadGameData(seedGameData));
  const [characters, setCharacters] = useState<CharacterRecord[]>(() => loadCharactersWithDefaultSheets());
  const [selectedId, setSelectedId] = useState("");
  const [campaignId, setCampaignId] = useState(() => appStorage.loadGameData(seedGameData).campaigns[0]?.id ?? "");
  const [classId, setClassId] = useState("");
  const [cloudReady, setCloudReady] = useState(!cloudEnabled);
  const [cloudStatus, setCloudStatus] = useState(
    cloudEnabled ? "Connecting to cloud..." : "Local storage mode"
  );
  const [campaignRowIdsByAppId, setCampaignRowIdsByAppId] = useState<Record<string, string>>({});
  const cloudInitDoneRef = useRef(false);

  useEffect(() => {
    appStorage.saveCharacters(characters);
  }, [characters]);

  useEffect(() => {
    appStorage.saveGameData(gameData);
  }, [gameData]);

  useEffect(() => {
    if (!cloudEnabled || cloudInitDoneRef.current) return;

    let isCancelled = false;

    async function initializeCloud() {
      try {
        setCloudStatus("Syncing from cloud...");

        let campaignRows = await listCampaignRows();

        // First run bootstrap: seed cloud with current local campaigns.
        if (campaignRows.length === 0) {
          for (const campaign of gameData.campaigns) {
            await upsertCampaignBySlug({
              slug: campaign.id,
              name: campaign.name,
              campaign,
            });
          }
          campaignRows = await listCampaignRows();
        }

        if (isCancelled) return;

        const nextCampaignMap = Object.fromEntries(
          campaignRows.map((row) => [row.data.id, row.id])
        );
        setCampaignRowIdsByAppId(nextCampaignMap);

        if (campaignRows.length > 0) {
          const nextGameData = createGameData({
            campaigns: campaignRows.map((row) => row.data),
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
          setCloudStatus("Cloud unavailable, using local data");
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
  }, [cloudEnabled]);

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
        for (const character of characters) {
          const campaignRowId = campaignRowIdsByAppId[character.campaignId];
          if (!campaignRowId) continue;
          await upsertCharacterRow({
            campaignId: campaignRowId,
            character,
          });
        }

        const remoteRows = await listAllCharacterRows();
        const localCharacterIds = new Set(characters.map((character) => character.id));

        for (const row of remoteRows) {
          if (knownCampaignRowIds.has(row.campaign_id) && !localCharacterIds.has(row.id)) {
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
    const nextClassId = getClassesForCampaign(gameData, nextCampaignId)[0]?.id ?? "";
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
    handleWizardClassChange,
    handleWizardAttributeGenerationChange,
    handleWizardRollAttributes,
    setWizardName,
  } = useCharacterCreation({
    gameData,
    campaignId,
    classId,
    getCampaignName,
    makeDraftFromCampaignAndClass,
    makeBaseAttributes,
    applyClassAttributeModifiers,
    getPointBuySpent,
    onFinishDraft: commitCreatedCharacter,
  });

  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId]
  );

  const selectedCampaign = selected
    ? gameData.campaigns.find((g) => g.id === selected.campaignId) ?? null
    : null;

  const selectedClass = selected ? getClassById(gameData, selected.classId) ?? null : null;

  const filteredCharacters = characters.filter((character) => character.campaignId === campaignId);
  const selectedSkills = selectedCampaign ? sortByName(selectedCampaign.skills) : [];

  const selectedPowers = selectedCampaign ? sortByName(selectedCampaign.powers) : [];

  const selectedItems = selectedCampaign ? sortByName(selectedCampaign.items) : [];
  const skillChoiceRules = selectedClass?.skillChoiceRules ?? [];
  const powerChoiceRules = selectedClass?.powerChoiceRules ?? [];
  const itemChoiceRules = selectedClass?.itemChoiceRules ?? [];

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

  const pointBuyTotal =
    selected?.attributeGeneration?.pointBuyTotal ??
    selectedCampaign?.attributeRules.pointBuyTotal ??
    27;

  const pointBuySpent = selected ? getPointBuySpent(selected.attributes) : 0;
  const pointBuyRemaining = pointBuyTotal - pointBuySpent;

  const roll20Commands = selected
    ? buildChatSetAttrPhases(selected, gameData)
    : { phase1: "", phase2: "", combined: "" };
  const chatSetAttrCommand = roll20Commands.combined;

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
    toggleItemWithRules,
    updateInventoryQuantity,
    updateInventoryEquipped,
    addManualItem,
    removeManualItem,
    deleteCharacter,
  } = useCharacterEditor({
    characters,
    selectedId,
    campaignId,
    selectedCampaign,
    selectedClass,
    getPointBuySpent,
    updateCharacter,
    setCharacters,
    setSelectedId,
  });

  const selectedWorkspaceCallbacks = useSelectedCharacterWorkspaceCallbacks({
    selected,
    selectedCampaign,
    updateCharacter,
    updateAttributeWithRules,
    updateSkillWithRules,
    togglePowerWithRules,
    toggleItemWithRules,
    updateInventoryQuantity,
    updateInventoryEquipped,
    removeManualItem,
    addManualItem,
  });

  return (
    <div style={pageStyle}>
      <div
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
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
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
                classesForCampaign={wizardClassesForCampaign}
                selectedCampaign={wizardCampaign}
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
                onClassChange={handleWizardClassChange}
                onAttributeGenerationChange={handleWizardAttributeGenerationChange}
                onAttributeChange={(key, value) => updateWizardAttributeWithRules(key, value)}
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
              selectedClassName={selectedClass?.name ?? "Unassigned"}
              labels={labels}
              pointBuyTotal={pointBuyTotal}
              pointBuyRemaining={pointBuyRemaining}
              selectedSkills={selectedSkills}
              selectedPowers={selectedPowers}
              selectedItems={selectedItems}
              skillChoiceRules={skillChoiceRules}
              powerChoiceRules={powerChoiceRules}
              itemChoiceRules={itemChoiceRules}
              chatSetAttrCommand={chatSetAttrCommand}
              roll20Phase1Command={roll20Commands.phase1}
              roll20Phase2Command={roll20Commands.phase2}
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