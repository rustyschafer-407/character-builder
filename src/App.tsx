import { useEffect, useMemo, useState } from "react";
import { gameData as seedGameData } from "./data/gameData";
import {
  createCharacterFromCampaignAndClass,
  generateId,
  getAttributeModifier,
  getClassById,
  getClassesForCampaign,
  touchCharacter,
} from "./lib/character";
import { buildChatSetAttrPhases } from "./lib/roll20Export";
import { appStorage } from "./storage/appStorage";
import type { CharacterRecord } from "./types/character";
import type {
  AttributeKey,
  CampaignDefinition,
  ClassLevelProgressionRow,
  ClassItemChoiceRule,
  LevelProgressionHpGainMode,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  GameData,
} from "./types/gameData";

import Sidebar from "./components/Sidebar";
import IdentitySection from "./components/IdentitySection";
import AttributesSection from "./components/AttributesSection";
import SheetFieldsSection from "./components/SheetFieldsSection";
import SkillsSection from "./components/SkillsSection";
import AttacksSection from "./components/AttacksSection";
import PowersSection from "./components/PowersSection";
import InventorySection from "./components/InventorySection";
import CharacterCreationWizard, {
  type CharacterCreationDraft,
} from "./components/CharacterCreationWizard";
import LevelUpWizard from "./components/LevelUpWizard";
import AdminScreen from "./components/AdminScreen";
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

const ATTRIBUTE_KEYS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

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

function getRuleForSkill(skillId: string, rules: ClassSkillChoiceRule[]) {
  return rules.find((rule) => rule.skillIds.includes(skillId));
}

function getSelectedCountForSkillRule(rule: ClassSkillChoiceRule, character: CharacterRecord) {
  return character.skills.filter(
    (skill) => rule.skillIds.includes(skill.skillId) && skill.proficient
  ).length;
}

function getRuleForPower(powerId: string, rules: ClassPowerChoiceRule[]) {
  return rules.find((rule) => rule.powerIds.includes(powerId));
}

function getSelectedCountForPowerRule(rule: ClassPowerChoiceRule, character: CharacterRecord) {
  return character.powers.filter(
    (power) => power.powerId && rule.powerIds.includes(power.powerId)
  ).length;
}

function getRuleForItem(itemId: string, rules: ClassItemChoiceRule[]) {
  return rules.find((rule) => rule.itemIds.includes(itemId));
}

function getSelectedCountForItemRule(rule: ClassItemChoiceRule, character: CharacterRecord) {
  return character.inventory.filter(
    (item) => item.itemId && rule.itemIds.includes(item.itemId)
  ).length;
}

function getAllowedSkillIdsForLevelUp(classRules: {
  levelUpSkillChoiceRules?: ClassSkillChoiceRule[];
  skillChoiceRules?: ClassSkillChoiceRule[];
}) {
  const levelUpRules = classRules.levelUpSkillChoiceRules ?? [];
  if (levelUpRules.length > 0) {
    return new Set(levelUpRules.flatMap((rule) => rule.skillIds));
  }

  const baseRules = classRules.skillChoiceRules ?? [];
  if (baseRules.length > 0) {
    return new Set(baseRules.flatMap((rule) => rule.skillIds));
  }

  return null;
}

function getAllowedPowerIdsForLevelUp(classRules: {
  levelUpPowerChoiceRules?: ClassPowerChoiceRule[];
  powerChoiceRules?: ClassPowerChoiceRule[];
}) {
  const levelUpRules = classRules.levelUpPowerChoiceRules ?? [];
  if (levelUpRules.length > 0) {
    return new Set(levelUpRules.flatMap((rule) => rule.powerIds));
  }

  const baseRules = classRules.powerChoiceRules ?? [];
  if (baseRules.length > 0) {
    return new Set(baseRules.flatMap((rule) => rule.powerIds));
  }

  return null;
}

function getNextLevelProgressionRow(
  character: CharacterRecord,
  classLevelProgression: ClassLevelProgressionRow[]
) {
  const nextLevel = character.level + 1;
  return classLevelProgression.find((row) => row.level === nextLevel) ?? null;
}

function buildMissingProgressionMessage(
  className: string,
  currentLevel: number,
  classLevelProgression: ClassLevelProgressionRow[]
) {
  const nextLevel = currentLevel + 1;
  const higherLevels = classLevelProgression
    .map((row) => row.level)
    .filter((level) => level > currentLevel)
    .sort((a, b) => a - b);

  if (higherLevels.length === 0) {
    return `No progression rows are defined above level ${currentLevel} for ${className}. Add a row for level ${nextLevel} in Admin before leveling up.`;
  }

  return `No progression row is defined for ${className} at level ${nextLevel}. The next configured progression row is level ${higherLevels[0]}. Add level ${nextLevel} in Admin before leveling up.`;
}

function getFixedAverageHpGain(hitDie: number) {
  return Math.floor(hitDie / 2) + 1;
}

function rollHitDie(hitDie: number) {
  return Math.floor(Math.random() * hitDie) + 1;
}

function getLevelUpHpGain(
  character: CharacterRecord,
  hitDie: number,
  rowHpGainMode: LevelProgressionHpGainMode | undefined,
  levelUpMode: "fixed-average" | "fixed-value" | "roll",
  levelUpFixedValue: number | undefined,
  hitDiceGained: number
) {
  if (hitDiceGained <= 0) return 0;

  const conMod = getAttributeModifier(character.attributes.CON);
  let total = 0;

  for (let i = 0; i < hitDiceGained; i += 1) {
    let perDieBase = getFixedAverageHpGain(hitDie);

    if (rowHpGainMode === "full") {
      perDieBase = hitDie;
    } else if (rowHpGainMode === "half") {
      perDieBase = getFixedAverageHpGain(hitDie);
    } else if (rowHpGainMode === "random") {
      perDieBase = rollHitDie(hitDie);
    } else if (levelUpMode === "fixed-value" && Number.isFinite(levelUpFixedValue)) {
      perDieBase = Math.max(1, Number(levelUpFixedValue));
    } else if (levelUpMode === "roll") {
      perDieBase = rollHitDie(hitDie);
    }

    total += Math.max(1, perDieBase + conMod);
  }

  return total;
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

function makeBlankCampaignForApp(): CampaignDefinition {
  return {
    id: `campaign-${Date.now()}`,
    name: "New Campaign",
    description: "",
    labels: {
      attributes: "Attributes",
      skills: "Skills",
      attacks: "Attacks",
      powers: "Powers",
      inventory: "Inventory",
      className: "Class",
      level: "Level",
      hp: "HP",
    },
    classes: [],
    skills: [],
    powers: [],
    items: [],
    attackTemplates: [],
    availableClassIds: [],
    availableSkillIds: [],
    availablePowerIds: [],
    availableItemIds: [],
    availableAttackTemplateIds: [],
    attributeRules: {
      generationMethods: ["manual"],
      pointBuyTotal: 27,
      randomRollFormula: "4d6 drop lowest",
      randomRollCount: 6,
      randomRollDropLowest: 1,
      minimumScore: 3,
      maximumScore: 18,
    },
  };
}

function getFirstVisibleCharacterId(
  characters: CharacterRecord[],
  selectedCampaignId: string
) {
  return characters.find((character) => character.campaignId === selectedCampaignId)?.id ?? "";
}

function loadCharactersWithDefaultSheets(): CharacterRecord[] {
  return appStorage.loadCharacters().map((character) =>
    character.sheet ? character : { ...character, sheet: makeDefaultSheet() }
  );
}

export default function App() {
  const [gameData, setGameData] = useState<GameData>(() => appStorage.loadGameData(seedGameData));
  const [characters, setCharacters] = useState<CharacterRecord[]>(() => loadCharactersWithDefaultSheets());
  const [selectedId, setSelectedId] = useState(() => characters[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState(() => appStorage.loadGameData(seedGameData).campaigns[0]?.id ?? "");
  const [classId, setClassId] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [creationDraft, setCreationDraft] = useState<CharacterCreationDraft | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAutoFocusCampaignName, setAdminAutoFocusCampaignName] = useState(false);
  const [adminSaveRequestVersion, setAdminSaveRequestVersion] = useState(0);
  const [roll20PreviewOpen, setRoll20PreviewOpen] = useState(false);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [levelUpApplyPending, setLevelUpApplyPending] = useState(false);
  const [levelUpSkillSelections, setLevelUpSkillSelections] = useState<string[]>([]);
  const [levelUpPowerSelections, setLevelUpPowerSelections] = useState<string[]>([]);
  const [levelUpMissingRowMessage, setLevelUpMissingRowMessage] = useState<string | null>(null);

  useEffect(() => {
    appStorage.saveCharacters(characters);
  }, [characters]);

  useEffect(() => {
    appStorage.saveGameData(gameData);
  }, [gameData]);

  function handleCampaignChange(nextCampaignId: string) {
    setCampaignId(nextCampaignId);
    const nextClassId = getClassesForCampaign(gameData, nextCampaignId)[0]?.id ?? "";
    setClassId(nextClassId);

    const currentlyVisible = characters.some(
      (character) =>
        character.id === selectedId && character.campaignId === nextCampaignId
    );

    if (!currentlyVisible) {
      setSelectedId(getFirstVisibleCharacterId(characters, nextCampaignId));
    }
  }

  function handleAdminSave(nextGameData: GameData) {
    const nextCampaignId = nextGameData.campaigns.some((campaign) => campaign.id === campaignId)
      ? campaignId
      : nextGameData.campaigns[0]?.id ?? "";
    const nextClassId = getClassesForCampaign(nextGameData, nextCampaignId)[0]?.id ?? "";

    setGameData(nextGameData);
    setCampaignId(nextCampaignId);
    setClassId(nextClassId);

    const selectedCharacter = characters.find((character) => character.id === selectedId) ?? null;
    if (!selectedCharacter || selectedCharacter.campaignId !== nextCampaignId) {
      setSelectedId(getFirstVisibleCharacterId(characters, nextCampaignId));
    }

    setAdminOpen(false);
    setAdminAutoFocusCampaignName(false);
  }

  function handleAdminGameDataChange(nextGameData: GameData) {
    const nextCampaignId = nextGameData.campaigns.some((campaign) => campaign.id === campaignId)
      ? campaignId
      : nextGameData.campaigns[0]?.id ?? "";
    const nextClassId = getClassesForCampaign(nextGameData, nextCampaignId)[0]?.id ?? "";

    setGameData(nextGameData);
    setCampaignId(nextCampaignId);
    setClassId(nextClassId);

    const selectedCharacter = characters.find((character) => character.id === selectedId) ?? null;
    if (!selectedCharacter || selectedCharacter.campaignId !== nextCampaignId) {
      setSelectedId(getFirstVisibleCharacterId(characters, nextCampaignId));
    }
  }

  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId]
  );

  const selectedCampaign = selected
    ? gameData.campaigns.find((g) => g.id === selected.campaignId) ?? null
    : null;

  const selectedClass = selected ? getClassById(gameData, selected.classId) ?? null : null;
  const nextLevelProgressionRow =
    selected && selectedClass
      ? getNextLevelProgressionRow(selected, selectedClass.levelProgression)
      : null;

  const classesForSelectedCampaign = getClassesForCampaign(gameData, campaignId);

  const filteredCharacters = characters.filter((character) => character.campaignId === campaignId);

  const selectedSkills = selectedCampaign ? selectedCampaign.skills : [];

  const selectedPowers = selectedCampaign ? selectedCampaign.powers : [];

  const selectedItems = selectedCampaign ? selectedCampaign.items : [];
  const allowedLevelUpSkillIds = selectedClass
    ? getAllowedSkillIdsForLevelUp(selectedClass)
    : null;
  const allowedLevelUpPowerIds = selectedClass
    ? getAllowedPowerIdsForLevelUp(selectedClass)
    : null;

  const availableLevelUpSkills = selected
    ? selectedSkills.filter((skill) => {
        const allowed = allowedLevelUpSkillIds
          ? allowedLevelUpSkillIds.has(skill.id)
          : true;
        const existing = selected.skills.find((entry) => entry.skillId === skill.id);
        return allowed && !existing?.proficient;
      })
    : [];
  const availableLevelUpPowers = selected
    ? selectedPowers.filter(
        (power) =>
          (allowedLevelUpPowerIds ? allowedLevelUpPowerIds.has(power.id) : true) &&
          !selected.powers.some((entry) => entry.powerId === power.id)
      )
    : [];

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

  const wizardCampaign = creationDraft
    ? gameData.campaigns.find((g) => g.id === creationDraft.campaignId) ?? null
    : null;

  const wizardClass = creationDraft
    ? getClassById(gameData, creationDraft.classId) ?? null
    : null;

  const wizardClassesForCampaign = creationDraft
    ? getClassesForCampaign(gameData, creationDraft.campaignId)
    : [];

  const wizardSkills = wizardCampaign ? wizardCampaign.skills : [];

  const wizardPowers = wizardCampaign ? wizardCampaign.powers : [];

  const wizardItems = wizardCampaign ? wizardCampaign.items : [];

  const wizardSkillChoiceRules = wizardClass?.skillChoiceRules ?? [];
  const wizardPowerChoiceRules = wizardClass?.powerChoiceRules ?? [];
  const wizardItemChoiceRules = wizardClass?.itemChoiceRules ?? [];

  const wizardPointBuyTotal =
    creationDraft?.attributeGeneration?.pointBuyTotal ??
    wizardCampaign?.attributeRules.pointBuyTotal ??
    27;

  const wizardPointBuySpent = creationDraft ? getPointBuySpent(creationDraft.attributes) : 0;
  const wizardPointBuyRemaining = wizardPointBuyTotal - wizardPointBuySpent;

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

  function openWizard() {
    const defaultCampaignId = campaignId || gameData.campaigns[0]?.id || "";
    const classesInCampaign = getClassesForCampaign(gameData, defaultCampaignId);
    const selectedClassInCampaign = classesInCampaign.some((cls) => cls.id === classId)
      ? classId
      : "";
    const defaultClassId = selectedClassInCampaign || classesInCampaign[0]?.id || "";

    const draft = makeDraftFromCampaignAndClass(
      gameData,
      defaultCampaignId,
      defaultClassId,
      `${getClassName(defaultClassId)} ${getCampaignName(defaultCampaignId)} Character`
    );

    if (!draft) return;

    setCreationDraft(draft);
    setWizardStep(0);
    setWizardOpen(true);
  }

  function openAdminForCurrentCampaign() {
    setAdminAutoFocusCampaignName(false);
    setAdminOpen(true);
  }

  function createCampaignAndOpenAdmin() {
    const newCampaign = makeBlankCampaignForApp();
    const nextGameData: GameData = {
      ...gameData,
      campaigns: [...gameData.campaigns, newCampaign],
    };

    setGameData(nextGameData);
    setCampaignId(newCampaign.id);
    setClassId("");
    setSelectedId(getFirstVisibleCharacterId(characters, newCampaign.id));
    setAdminAutoFocusCampaignName(true);
    setAdminOpen(true);
  }

  function closeWizard() {
    setWizardOpen(false);
    setWizardStep(0);
    setCreationDraft(null);
  }

  function openLevelUpWizard() {
    if (!selected || !selectedClass) return;

    const row = getNextLevelProgressionRow(selected, selectedClass.levelProgression);
    if (!row) {
      setLevelUpMissingRowMessage(
        buildMissingProgressionMessage(
          selectedClass.name,
          selected.level,
          selectedClass.levelProgression
        )
      );
      setLevelUpSkillSelections([]);
      setLevelUpPowerSelections([]);
      setLevelUpOpen(true);
      return;
    }

    if (selected.levelProgression.appliedLevels.includes(selected.level + 1)) {
      setLevelUpMissingRowMessage(
        `Level ${selected.level + 1} has already been applied for ${selected.identity.name}.`
      );
      setLevelUpSkillSelections([]);
      setLevelUpPowerSelections([]);
      setLevelUpOpen(true);
      return;
    }

    setLevelUpApplyPending(false);
    setLevelUpMissingRowMessage(null);
    setLevelUpSkillSelections([]);
    setLevelUpPowerSelections([]);
    setLevelUpOpen(true);
  }

  function closeLevelUpWizard() {
    setLevelUpOpen(false);
    setLevelUpApplyPending(false);
    setLevelUpSkillSelections([]);
    setLevelUpPowerSelections([]);
    setLevelUpMissingRowMessage(null);
  }

  function finishWizard() {
    if (!creationDraft) return;

    const character: CharacterRecord = {
      id: generateId(),
      identity: creationDraft.identity,
      campaignId: creationDraft.campaignId,
      classId: creationDraft.classId,
      level: creationDraft.level,
      proficiencyBonus: creationDraft.proficiencyBonus,
      attributes: creationDraft.attributes,
      attributeGeneration: creationDraft.attributeGeneration,
      hp: creationDraft.hp,
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
      skills: creationDraft.skills,
      powers: creationDraft.powers,
      inventory: creationDraft.inventory,
      attacks: creationDraft.attacks,
      levelProgression: creationDraft.levelProgression,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCharacters((prev) => [...prev, character]);
    setSelectedId(character.id);
    closeWizard();
  }

  function toggleLevelUpSkill(skillId: string, nextSelected: boolean) {
    if (!nextLevelProgressionRow) return;
    const maxChoices = nextLevelProgressionRow.newSkillChoices;

    if (nextSelected) {
      if (levelUpSkillSelections.includes(skillId)) return;
      if (levelUpSkillSelections.length >= maxChoices) return;
      if (!availableLevelUpSkills.some((skill) => skill.id === skillId)) return;
      setLevelUpSkillSelections((prev) => [...prev, skillId]);
      return;
    }

    setLevelUpSkillSelections((prev) => prev.filter((id) => id !== skillId));
  }

  function toggleLevelUpPower(powerId: string, nextSelected: boolean) {
    if (!nextLevelProgressionRow) return;
    const maxChoices = nextLevelProgressionRow.newPowerChoices;

    if (nextSelected) {
      if (levelUpPowerSelections.includes(powerId)) return;
      if (levelUpPowerSelections.length >= maxChoices) return;
      if (!availableLevelUpPowers.some((power) => power.id === powerId)) return;
      setLevelUpPowerSelections((prev) => [...prev, powerId]);
      return;
    }

    setLevelUpPowerSelections((prev) => prev.filter((id) => id !== powerId));
  }

  function applyLevelUp() {
    if (!selected || !selectedCampaign || !selectedClass || !nextLevelProgressionRow) return;
    if (levelUpApplyPending) return;

    const nextLevel = selected.level + 1;

    if (nextLevelProgressionRow.level !== nextLevel) {
      alert("Level progression data is out of sync. Reopen the level-up wizard and try again.");
      return;
    }

    if (selected.levelProgression.appliedLevels.includes(nextLevel)) {
      alert(`Level ${nextLevel} has already been applied.`);
      closeLevelUpWizard();
      return;
    }

    const availableSkillIdSet = new Set(availableLevelUpSkills.map((skill) => skill.id));
    const availablePowerIdSet = new Set(availableLevelUpPowers.map((power) => power.id));

    if (levelUpSkillSelections.some((skillId) => !availableSkillIdSet.has(skillId))) {
      alert("One or more selected skills are no longer valid for this level-up.");
      return;
    }

    if (levelUpPowerSelections.some((powerId) => !availablePowerIdSet.has(powerId))) {
      alert("One or more selected powers are no longer valid for this level-up.");
      return;
    }

    if (new Set(levelUpSkillSelections).size !== levelUpSkillSelections.length) {
      alert("Duplicate skills are not allowed.");
      return;
    }

    if (new Set(levelUpPowerSelections).size !== levelUpPowerSelections.length) {
      alert("Duplicate powers are not allowed.");
      return;
    }

    if (levelUpSkillSelections.length !== nextLevelProgressionRow.newSkillChoices) {
      alert("Please complete the required skill choices before applying level up.");
      return;
    }

    if (levelUpPowerSelections.length !== nextLevelProgressionRow.newPowerChoices) {
      alert("Please complete the required power choices before applying level up.");
      return;
    }

    setLevelUpApplyPending(true);

    const addedPowers = levelUpPowerSelections
      .map((powerId) => selectedCampaign.powers.find((power) => power.id === powerId))
      .filter((power): power is NonNullable<typeof power> => Boolean(power))
      .map((power) => ({
        powerId: power.id,
        name: power.name,
        notes: power.description,
        source: "level-up" as const,
      }));

    const nextAttributes = { ...selected.attributes };
    const nextAttributeIncreaseTotals = {
      ...selected.levelProgression.appliedAttributeIncreases,
    };

    for (const bonus of nextLevelProgressionRow.attributeBonuses) {
      nextAttributes[bonus.attribute] += bonus.amount;
      nextAttributeIncreaseTotals[bonus.attribute] += bonus.amount;
    }

    const hpGain = getLevelUpHpGain(
      selected,
      selectedClass.hpRule.hitDie,
      nextLevelProgressionRow.hpGainMode,
      selectedClass.hpRule.levelUpMode,
      selectedClass.hpRule.levelUpFixedValue,
      nextLevelProgressionRow.hitDiceGained
    );

    const updated: CharacterRecord = {
      ...selected,
      level: selected.level + 1,
      attributes: nextAttributes,
      hp: {
        ...selected.hp,
        max: selected.hp.max + hpGain,
        current: Math.min(selected.hp.max + hpGain, selected.hp.current + hpGain),
      },
      skills: selected.skills.map((skill) =>
        levelUpSkillSelections.includes(skill.skillId)
          ? { ...skill, proficient: true, source: "level-up" }
          : skill
      ),
      powers: [...selected.powers, ...addedPowers],
      levelProgression: {
        totalHitDice:
          selected.levelProgression.totalHitDice + nextLevelProgressionRow.hitDiceGained,
        gainedSkillIds: Array.from(
          new Set([...selected.levelProgression.gainedSkillIds, ...levelUpSkillSelections])
        ),
        gainedPowerIds: Array.from(
          new Set([...selected.levelProgression.gainedPowerIds, ...levelUpPowerSelections])
        ),
        appliedLevels: Array.from(
          new Set([...selected.levelProgression.appliedLevels, nextLevel])
        ).sort((a, b) => a - b),
        appliedAttributeIncreases: nextAttributeIncreaseTotals,
      },
    };

    updateCharacter(updated);
    closeLevelUpWizard();
  }

  function validateWizardStep() {
    if (!creationDraft) return false;

    if (wizardStep === 0) {
      return Boolean(creationDraft.campaignId && creationDraft.identity.name.trim());
    }

    if (wizardStep === 1) {
      return Boolean(creationDraft.classId);
    }

    if (wizardStep === 3) {
      return wizardSkillChoiceRules.every((rule) => {
        const count = creationDraft.skills.filter(
          (skill) => rule.skillIds.includes(skill.skillId) && skill.proficient
        ).length;
        return count === rule.choose;
      });
    }

    if (wizardStep === 4) {
      return wizardPowerChoiceRules.every((rule) => {
        const count = creationDraft.powers.filter(
          (power) => power.powerId && rule.powerIds.includes(power.powerId)
        ).length;
        return count === rule.choose;
      });
    }

    if (wizardStep === 5) {
      return wizardItemChoiceRules.every((rule) => {
        const count = creationDraft.inventory.filter(
          (item) => item.itemId && rule.itemIds.includes(item.itemId)
        ).length;
        return count <= rule.choose;
      });
    }

    return true;
  }

  function nextWizardStep() {
    if (!validateWizardStep()) {
      alert("Please complete the required choices for this step before continuing.");
      return;
    }

    setWizardStep((prev) => Math.min(prev + 1, 6));
  }

  function previousWizardStep() {
    setWizardStep((prev) => Math.max(prev - 1, 0));
  }

  function updateCharacter(updated: CharacterRecord) {
    setCharacters((prev) =>
      prev.map((c) => (c.id === updated.id ? touchCharacter(updated) : c))
    );
  }

  function updateAttributeWithRules(character: CharacterRecord, key: AttributeKey, value: number) {
    const method = character.attributeGeneration?.method ?? "manual";

    if (method === "pointBuy") {
      const clamped = Math.max(8, Math.min(15, value));

      const nextAttributes = {
        ...character.attributes,
        [key]: clamped,
      };

      const totalAllowed = character.attributeGeneration?.pointBuyTotal ?? 27;
      const spent = getPointBuySpent(nextAttributes);

      if (spent > totalAllowed) return;

      updateCharacter({
        ...character,
        attributes: nextAttributes,
      });
      return;
    }

    updateCharacter({
      ...character,
      attributes: {
        ...character.attributes,
        [key]: value,
      },
    });
  }

  function updateWizardAttributeWithRules(key: AttributeKey, value: number) {
    if (!creationDraft) return;

    const method = creationDraft.attributeGeneration?.method ?? "manual";

    if (method === "pointBuy") {
      const clamped = Math.max(8, Math.min(15, value));
      const nextAttributes = {
        ...creationDraft.attributes,
        [key]: clamped,
      };
      const totalAllowed = creationDraft.attributeGeneration?.pointBuyTotal ?? 27;
      const spent = getPointBuySpent(nextAttributes);

      if (spent > totalAllowed) return;

      setCreationDraft({
        ...creationDraft,
        attributes: nextAttributes,
      });
      return;
    }

    setCreationDraft({
      ...creationDraft,
      attributes: {
        ...creationDraft.attributes,
        [key]: value,
      },
    });
  }

  function updateSkillWithRules(
    character: CharacterRecord,
    field: "proficient" | "bonus",
    skillId: string,
    value: boolean | number
  ) {
    if (field === "bonus") {
      updateCharacter({
        ...character,
        skills: character.skills.map((skill) =>
          skill.skillId === skillId ? { ...skill, bonus: value as number } : skill
        ),
      });
      return;
    }

    const nextProficient = value as boolean;
    const rules = selectedClass?.skillChoiceRules ?? [];

    if (nextProficient) {
      if (rules.length > 0) {
        const rule = getRuleForSkill(skillId, rules);
        if (!rule) {
          alert("That skill cannot be chosen for this class.");
          return;
        }

        const selectedCount = getSelectedCountForSkillRule(rule, character);
        if (selectedCount >= rule.choose) {
          alert("You have already selected the maximum number of skill proficiencies for that group.");
          return;
        }
      }

      updateCharacter({
        ...character,
        skills: character.skills.map((skill) =>
          skill.skillId === skillId
            ? { ...skill, proficient: true, source: "wizard-choice" }
            : skill
        ),
      });
      return;
    }

    updateCharacter({
      ...character,
      skills: character.skills.map((skill) =>
        skill.skillId === skillId ? { ...skill, proficient: false } : skill
      ),
    });
  }

  function toggleWizardSkill(skillId: string, nextSelected: boolean) {
    if (!creationDraft) return;

    if (nextSelected) {
      const rule = getRuleForSkill(skillId, wizardSkillChoiceRules);
      if (!rule) {
        alert("That skill cannot be chosen for this class.");
        return;
      }
      const selectedCount = creationDraft.skills.filter(
        (skill) => rule.skillIds.includes(skill.skillId) && skill.proficient
      ).length;
      if (selectedCount >= rule.choose) {
        alert("You have already selected the maximum number of skill proficiencies for that group.");
        return;
      }
    }

    setCreationDraft({
      ...creationDraft,
      skills: creationDraft.skills.map((skill) =>
        skill.skillId === skillId
          ? {
              ...skill,
              proficient: nextSelected,
              source: nextSelected ? "wizard-choice" : skill.source,
            }
          : skill
      ),
    });
  }

  function togglePowerWithRules(character: CharacterRecord, powerId: string, nextSelected: boolean) {
    const power = selectedCampaign?.powers.find((p) => p.id === powerId);
    if (!power) return;

    const rules = selectedClass?.powerChoiceRules ?? [];

    if (nextSelected) {
      const alreadySelected = character.powers.some((p) => p.powerId === powerId);
      if (alreadySelected) return;

      if (rules.length > 0) {
        const rule = getRuleForPower(powerId, rules);
        if (!rule) {
          alert("That power cannot be chosen for this class.");
          return;
        }

        const selectedCount = getSelectedCountForPowerRule(rule, character);
        if (selectedCount >= rule.choose) {
          alert("You have already selected the maximum number of powers for that group.");
          return;
        }
      }

      updateCharacter({
        ...character,
        powers: [
          ...character.powers,
          {
            powerId: power.id,
            name: power.name,
            notes: power.description,
            source: "wizard-choice",
          },
        ],
      });
      return;
    }

    updateCharacter({
      ...character,
      powers: character.powers.filter((p) => p.powerId !== powerId),
    });
  }

  function toggleWizardPower(powerId: string, nextSelected: boolean) {
    if (!creationDraft || !wizardCampaign) return;

    const power = wizardCampaign.powers.find((p) => p.id === powerId);
    if (!power) return;

    if (nextSelected) {
      const alreadySelected = creationDraft.powers.some((p) => p.powerId === powerId);
      if (alreadySelected) return;

      const rule = getRuleForPower(powerId, wizardPowerChoiceRules);
      if (!rule) {
        alert("That power cannot be chosen for this class.");
        return;
      }

      const selectedCount = creationDraft.powers.filter(
        (p) => p.powerId && rule.powerIds.includes(p.powerId)
      ).length;

      if (selectedCount >= rule.choose) {
        alert("You have already selected the maximum number of powers for that group.");
        return;
      }

      setCreationDraft({
        ...creationDraft,
        powers: [
          ...creationDraft.powers,
          {
            powerId: power.id,
            name: power.name,
            notes: power.description,
            source: "wizard-choice",
          },
        ],
      });
      return;
    }

    setCreationDraft({
      ...creationDraft,
      powers: creationDraft.powers.filter((p) => p.powerId !== powerId),
    });
  }

  function toggleItemWithRules(character: CharacterRecord, itemId: string, nextSelected: boolean) {
    const item = selectedCampaign?.items.find((i) => i.id === itemId);
    if (!item) return;

    const rules = selectedClass?.itemChoiceRules ?? [];

    if (nextSelected) {
      const alreadySelected = character.inventory.some((i) => i.itemId === itemId);
      if (alreadySelected) return;

      if (rules.length > 0) {
        const rule = getRuleForItem(itemId, rules);
        if (!rule) {
          alert("That item cannot be chosen for this class.");
          return;
        }

        const selectedCount = getSelectedCountForItemRule(rule, character);
        if (selectedCount >= rule.choose) {
          alert("You have already selected the maximum number of items for that group.");
          return;
        }
      }

      updateCharacter({
        ...character,
        inventory: [
          ...character.inventory,
          {
            itemId: item.id,
            name: item.name,
            quantity: item.defaultQuantity ?? 1,
            notes: item.description,
            equipped: false,
            source: "wizard-choice",
          },
        ],
      });
      return;
    }

    updateCharacter({
      ...character,
      inventory: character.inventory.filter((i) => i.itemId !== itemId),
    });
  }

  function toggleWizardItem(itemId: string, nextSelected: boolean) {
    if (!creationDraft || !wizardCampaign) return;

    const item = wizardCampaign.items.find((i) => i.id === itemId);
    if (!item) return;

    if (nextSelected) {
      const alreadySelected = creationDraft.inventory.some((i) => i.itemId === itemId);
      if (alreadySelected) return;

      const rule = getRuleForItem(itemId, wizardItemChoiceRules);
      if (!rule) {
        alert("That item cannot be chosen for this class.");
        return;
      }

      const selectedCount = creationDraft.inventory.filter(
        (i) => i.itemId && rule.itemIds.includes(i.itemId)
      ).length;

      if (selectedCount >= rule.choose) {
        alert("You have already selected the maximum number of items for that group.");
        return;
      }

      setCreationDraft({
        ...creationDraft,
        inventory: [
          ...creationDraft.inventory,
          {
            itemId: item.id,
            name: item.name,
            quantity: item.defaultQuantity ?? 1,
            notes: item.description,
            equipped: false,
            source: "wizard-choice",
          },
        ],
      });
      return;
    }

    setCreationDraft({
      ...creationDraft,
      inventory: creationDraft.inventory.filter((i) => i.itemId !== itemId),
    });
  }

  function updateInventoryQuantity(character: CharacterRecord, itemKey: string, quantity: number) {
    updateCharacter({
      ...character,
      inventory: character.inventory.map((item) =>
        (item.itemId ?? item.name) === itemKey
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      ),
    });
  }

  function updateInventoryEquipped(character: CharacterRecord, itemKey: string, equipped: boolean) {
    updateCharacter({
      ...character,
      inventory: character.inventory.map((item) =>
        (item.itemId ?? item.name) === itemKey
          ? { ...item, equipped }
          : item
      ),
    });
  }

  function addManualItem(character: CharacterRecord) {
    updateCharacter({
      ...character,
      inventory: [
        ...character.inventory,
        {
          name: `Custom Item ${character.inventory.filter((i) => !i.itemId).length + 1}`,
          quantity: 1,
          equipped: false,
          source: "manual",
        },
      ],
    });
  }

  function removeManualItem(character: CharacterRecord, itemName: string) {
    updateCharacter({
      ...character,
      inventory: character.inventory.filter(
        (item) => !(item.source === "manual" && item.name === itemName)
      ),
    });
  }

  function deleteCharacter(id: string) {
    const character = characters.find((c) => c.id === id);
    const displayName = character?.identity.name?.trim() || "this character";

    const confirmed = window.confirm(`Delete ${displayName}? This cannot be undone.`);
    if (!confirmed) return;

    const remaining = characters.filter((c) => c.id !== id);
    setCharacters(remaining);

    if (id === selectedId || !remaining.some((character) => character.id === selectedId)) {
      setSelectedId(getFirstVisibleCharacterId(remaining, campaignId));
    }
  }

  async function copyChatSetAttr() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(chatSetAttrCommand);
      alert("Roll20 import commands copied. Paste Attributes & Core first, then Repeating Lists.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  async function copyChatSetAttrPhase1() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(roll20Commands.phase1);
      alert("Roll20 Attributes & Core command copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  async function copyChatSetAttrPhase2() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(roll20Commands.phase2);
      alert("Roll20 Repeating Lists commands copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  async function copyCurrentPreview() {
    try {
      await navigator.clipboard.writeText(chatSetAttrCommand);
      alert("Command copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

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
            <button
              onClick={() => {
                setAdminOpen(false);
                setAdminAutoFocusCampaignName(false);
              }}
              style={buttonStyle}
            >
              Cancel
            </button>
            <button
              onClick={() => setAdminSaveRequestVersion((value) => value + 1)}
              style={primaryButtonStyle}
            >
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
            classesForSelectedCampaign={classesForSelectedCampaign}
            characters={filteredCharacters}
            selectedId={selectedId}
            newClassId={classId}
            onSelect={setSelectedId}
            onCreate={openWizard}
            onDelete={deleteCharacter}
            onClassChange={setClassId}
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
                onNameChange={(name) =>
                  setCreationDraft({
                    ...creationDraft,
                    identity: {
                      ...creationDraft.identity,
                      name,
                    },
                  })
                }
                onCampaignChange={(nextCampaignId) => {
                  const nextClassId = getClassesForCampaign(gameData, nextCampaignId)[0]?.id ?? "";
                  const nextDraft = makeDraftFromCampaignAndClass(
                    gameData,
                    nextCampaignId,
                    nextClassId,
                    creationDraft.identity.name
                  );
                  if (nextDraft) {
                    setCreationDraft(nextDraft);
                  }
                }}
                onClassChange={(nextClassId) => {
                  const nextDraft = makeDraftFromCampaignAndClass(
                    gameData,
                    creationDraft.campaignId,
                    nextClassId,
                    creationDraft.identity.name
                  );
                  if (nextDraft) {
                    setCreationDraft(nextDraft);
                  }
                }}
                onAttributeGenerationChange={(method) =>
                  setCreationDraft({
                    ...creationDraft,
                    attributes:
                      method === "manual"
                        ? creationDraft.attributes
                        : applyClassAttributeModifiers(makeBaseAttributes(), wizardClass),
                    attributeGeneration: {
                      ...creationDraft.attributeGeneration,
                      method,
                      pointBuyTotal:
                        creationDraft.attributeGeneration?.pointBuyTotal ?? wizardPointBuyTotal,
                    },
                  })
                }
                onAttributeChange={(key, value) => updateWizardAttributeWithRules(key, value)}
                onRollAttributes={() => {
                  const values = Array.from({ length: 6 }).map(() => {
                    const dice = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
                    dice.sort((a, b) => b - a);
                    return dice[0] + dice[1] + dice[2];
                  });

                  const rolledAttributes = { ...creationDraft.attributes };

                  ATTRIBUTE_KEYS.forEach((attr, i) => {
                    rolledAttributes[attr] = values[i];
                  });

                  const newAttributes = applyClassAttributeModifiers(rolledAttributes, wizardClass);

                  setCreationDraft({
                    ...creationDraft,
                    attributes: newAttributes,
                    attributeGeneration: {
                      ...creationDraft.attributeGeneration,
                      method: "randomRoll",
                      rolls: values,
                    },
                  });
                }}
                onSkillToggle={toggleWizardSkill}
                onPowerToggle={toggleWizardPower}
                onItemToggle={toggleWizardItem}
                onBack={previousWizardStep}
                onNext={nextWizardStep}
                onCancel={closeWizard}
                onFinish={finishWizard}
              />
            </div>
          ) : levelUpOpen && selected && selectedCampaign && selectedClass ? (
            <div style={{ flex: 1 }}>
              <LevelUpWizard
                character={selected}
                className={selectedClass.name}
                labels={labels}
                nextLevel={selected.level + 1}
                hitDiceGained={nextLevelProgressionRow?.hitDiceGained ?? 0}
                attributeBonuses={nextLevelProgressionRow?.attributeBonuses ?? []}
                newSkillChoices={nextLevelProgressionRow?.newSkillChoices ?? 0}
                newPowerChoices={nextLevelProgressionRow?.newPowerChoices ?? 0}
                availableSkillChoices={availableLevelUpSkills}
                availablePowerChoices={availableLevelUpPowers}
                selectedSkillIds={levelUpSkillSelections}
                selectedPowerIds={levelUpPowerSelections}
                missingProgressionMessage={levelUpMissingRowMessage}
                onToggleSkill={toggleLevelUpSkill}
                onTogglePower={toggleLevelUpPower}
                onCancel={closeLevelUpWizard}
                onApply={applyLevelUp}
                applyPending={levelUpApplyPending}
              />
            </div>
          ) : !selected || !selectedCampaign ? (
            <div
              style={{
                ...panelStyle,
                flex: 1,
              }}
            >
              <p style={{ margin: 0, ...mutedTextStyle }}>Create a character to begin.</p>
            </div>
          ) : (
            <div style={{ flex: 1, display: "grid", gap: 24 }}>
              <section style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ color: "var(--text-secondary)" }}>
                    Advance this character to the next class level progression step.
                  </div>
                  <button onClick={openLevelUpWizard} style={buttonStyle}>
                    Level Up
                  </button>
                </div>
              </section>

              <IdentitySection
                character={selected}
                campaignName={selectedCampaign.name}
                classLabel={labels.className}
                className={selectedClass?.name ?? "Unassigned"}
                levelLabel={labels.level}
                hpLabel={labels.hp}
                onNameChange={(name: string) =>
                  updateCharacter({
                    ...selected,
                    identity: {
                      ...selected.identity,
                      name,
                    },
                  })
                }
              />

              <AttributesSection
                character={selected}
                label={labels.attributes}
                pointBuyTotal={pointBuyTotal}
                pointBuyRemaining={pointBuyRemaining}
                onChange={(k: AttributeKey, v: number) =>
                  updateAttributeWithRules(selected, k, v)
                }
                onGenerationChange={(method) =>
                  updateCharacter({
                    ...selected,
                    attributeGeneration: {
                      ...selected.attributeGeneration,
                      method,
                      pointBuyTotal:
                        selected.attributeGeneration?.pointBuyTotal ??
                        selectedCampaign.attributeRules.pointBuyTotal ??
                        27,
                    },
                  })
                }
                onApplyRolls={(values) => {
                  const attrs: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
                  const newAttributes = { ...selected.attributes };

                  attrs.forEach((attr, i) => {
                    newAttributes[attr] = values[i];
                  });

                  updateCharacter({
                    ...selected,
                    attributes: newAttributes,
                    attributeGeneration: {
                      ...selected.attributeGeneration,
                      method: "randomRoll",
                      rolls: values,
                    },
                  });
                }}
              />

              <SheetFieldsSection
                character={selected}
                onSpeedChange={(value) =>
                  updateCharacter({
                    ...selected,
                    sheet: { ...selected.sheet, speed: value },
                  })
                }
                onAcBaseChange={(value) =>
                  updateCharacter({
                    ...selected,
                    sheet: { ...selected.sheet, acBase: value },
                  })
                }
                onAcBonusChange={(value) =>
                  updateCharacter({
                    ...selected,
                    sheet: { ...selected.sheet, acBonus: value },
                  })
                }
                onAcUseDexChange={(value) =>
                  updateCharacter({
                    ...selected,
                    sheet: { ...selected.sheet, acUseDex: value },
                  })
                }
                onInitMiscChange={(value) =>
                  updateCharacter({
                    ...selected,
                    sheet: { ...selected.sheet, initMisc: value },
                  })
                }
                onSaveProfChange={(attr, value) =>
                  updateCharacter({
                    ...selected,
                    sheet: {
                      ...selected.sheet,
                      saveProf: {
                        ...selected.sheet.saveProf,
                        [attr]: value,
                      },
                    },
                  })
                }
                onSaveBonusChange={(attr, value) =>
                  updateCharacter({
                    ...selected,
                    sheet: {
                      ...selected.sheet,
                      saveBonus: {
                        ...selected.sheet.saveBonus,
                        [attr]: value,
                      },
                    },
                  })
                }
              />

              <SkillsSection
                character={selected}
                skills={selectedSkills}
                label={labels.skills}
                skillChoiceRules={skillChoiceRules}
                onChange={(id, field, value) =>
                  updateSkillWithRules(selected, field, id, value)
                }
              />

              <PowersSection
                character={selected}
                powers={selectedPowers}
                label={labels.powers}
                powerChoiceRules={powerChoiceRules}
                onTogglePower={(powerId, nextSelected) =>
                  togglePowerWithRules(selected, powerId, nextSelected)
                }
              />

              <InventorySection
                character={selected}
                items={selectedItems}
                label={labels.inventory}
                itemChoiceRules={itemChoiceRules}
                onToggleItem={(itemId, nextSelected) =>
                  toggleItemWithRules(selected, itemId, nextSelected)
                }
                onQuantityChange={(itemKey, quantity) =>
                  updateInventoryQuantity(selected, itemKey, quantity)
                }
                onEquippedChange={(itemKey, equipped) =>
                  updateInventoryEquipped(selected, itemKey, equipped)
                }
                onRemoveManualItem={(itemName) => removeManualItem(selected, itemName)}
                onAddManualItem={() => addManualItem(selected)}
              />

              <AttacksSection
                character={selected}
                label={labels.attacks}
                onAdd={() =>
                  updateCharacter({
                    ...selected,
                    attacks: [
                      ...selected.attacks,
                      {
                        id: generateId(),
                        name: "New Attack",
                        attribute: "STR",
                        damage: "1d6",
                        bonus: 0,
                        damageBonus: 0,
                      },
                    ],
                  })
                }
                onChange={(id, field, value) =>
                  updateCharacter({
                    ...selected,
                    attacks: selected.attacks.map((attack) =>
                      attack.id === id ? { ...attack, [field]: value } : attack
                    ),
                  })
                }
              />

              <section style={panelStyle}>
                <h3 style={{ marginTop: 0, color: "var(--text-primary)" }}>Roll20 Import</h3>
                <p style={{ marginTop: 0, color: "var(--text-secondary)", marginBottom: 12 }}>
                  Requires the{" "}
                  <a
                    href="https://github.com/Roll20/roll20-api-scripts/tree/master/ChatSetAttr"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#2563eb" }}
                  >
                    ChatSetAttr
                  </a>{" "}
                  API script (Roll20 Pro). <strong>Select your character's token</strong> in Roll20, then paste <strong>Attributes & Core</strong> and then <strong>Repeating Lists</strong>.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={copyChatSetAttrPhase1} style={buttonStyle}>
                    Copy Attributes & Core
                  </button>
                  <button onClick={copyChatSetAttrPhase2} style={buttonStyle}>
                    Copy Repeating Lists
                  </button>
                  <button onClick={copyChatSetAttr} style={primaryButtonStyle}>
                    Copy Both Commands
                  </button>
                  <button onClick={() => setRoll20PreviewOpen(true)} style={buttonStyle}>
                    Preview Command
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {roll20PreviewOpen && selected && (
        <div
          onClick={() => setRoll20PreviewOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17, 24, 39, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1000px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              background: "linear-gradient(165deg, var(--surface-2), var(--surface-1))",
              borderRadius: 14,
              border: "1px solid var(--border-soft)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Roll20 Import Commands</h2>
                <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                  {selected.identity.name || "Unnamed Character"} — paste Attributes & Core, then Repeating Lists
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={copyCurrentPreview} style={buttonStyle}>
                  Copy
                </button>
                <button onClick={() => setRoll20PreviewOpen(false)} style={buttonStyle}>
                  Close
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={chatSetAttrCommand}
              style={{
                width: "100%",
                minHeight: 300,
                borderRadius: 10,
                border: "1px solid var(--border-soft)",
                padding: 14,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text-primary)",
                background: "rgba(7, 14, 29, 0.84)",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}