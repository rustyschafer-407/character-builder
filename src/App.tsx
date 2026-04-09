import { useEffect, useMemo, useState } from "react";
import { gameData as seedGameData } from "./data/gameData";
import {
  createCharacterFromCampaignAndClass,
  generateId,
  getClassById,
  getClassesForCampaign,
  touchCharacter,
} from "./lib/character";
import { buildChatSetAttrPhases } from "./lib/roll20Export";
import { loadCharacters, saveCharacters } from "./storage/characterStorage";
import { loadGameData, saveGameData } from "./storage/gameDataStorage";
import type { CharacterRecord } from "./types/character";
import type {
  AttributeKey,
  ClassItemChoiceRule,
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
import AdminScreen from "./components/AdminScreen";
import { buttonStyle, mutedTextStyle, pageStyle, panelStyle, primaryButtonStyle } from "./components/uiStyles";

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

function loadCharactersWithDefaultSheets(): CharacterRecord[] {
  return loadCharacters().map((character) =>
    character.sheet ? character : { ...character, sheet: makeDefaultSheet() }
  );
}

export default function App() {
  const [gameData, setGameData] = useState<GameData>(() => loadGameData(seedGameData));
  const [characters, setCharacters] = useState<CharacterRecord[]>(() => loadCharactersWithDefaultSheets());
  const [selectedId, setSelectedId] = useState(() => characters[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState(() => loadGameData(seedGameData).campaigns[0]?.id ?? "");
  const [classId, setClassId] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [creationDraft, setCreationDraft] = useState<CharacterCreationDraft | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [roll20PreviewOpen, setRoll20PreviewOpen] = useState(false);

  useEffect(() => {
    saveCharacters(characters);
  }, [characters]);

  useEffect(() => {
    saveGameData(gameData);
  }, [gameData]);

  function handleCampaignChange(nextCampaignId: string) {
    setCampaignId(nextCampaignId);
    const nextClassId = getClassesForCampaign(gameData, nextCampaignId)[0]?.id ?? "";
    setClassId(nextClassId);
  }

  function handleAdminSave(nextGameData: GameData) {
    const nextCampaignId = nextGameData.campaigns.some((campaign) => campaign.id === campaignId)
      ? campaignId
      : nextGameData.campaigns[0]?.id ?? "";
    const nextClassId = getClassesForCampaign(nextGameData, nextCampaignId)[0]?.id ?? "";

    setGameData(nextGameData);
    setCampaignId(nextCampaignId);
    setClassId(nextClassId);
    setAdminOpen(false);
  }

  const selected = useMemo(
    () => characters.find((c) => c.id === selectedId) ?? null,
    [characters, selectedId]
  );

  const selectedCampaign = selected
    ? gameData.campaigns.find((g) => g.id === selected.campaignId) ?? null
    : null;

  const selectedClass = selected ? getClassById(gameData, selected.classId) ?? null : null;

  const classesForSelectedCampaign = getClassesForCampaign(gameData, campaignId);

  const selectedSkills = selectedCampaign ? selectedCampaign.skills : [];

  const selectedPowers = selectedCampaign ? selectedCampaign.powers : [];

  const selectedItems = selectedCampaign ? selectedCampaign.items : [];

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

  function closeWizard() {
    setWizardOpen(false);
    setWizardStep(0);
    setCreationDraft(null);
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCharacters((prev) => [...prev, character]);
    setSelectedId(character.id);
    closeWizard();
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

    if (id === selectedId) {
      setSelectedId(remaining[0]?.id ?? "");
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

        <button onClick={() => setAdminOpen((prev) => !prev)} style={buttonStyle}>
          {adminOpen ? "Close Admin" : "Open Admin"}
        </button>
      </div>

      {adminOpen ? (
        <AdminScreen
          gameData={gameData}
          onSave={handleAdminSave}
          onClose={() => setAdminOpen(false)}
        />
      ) : (
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          <Sidebar
            campaigns={gameData.campaigns}
            classesForSelectedCampaign={classesForSelectedCampaign}
            characters={characters}
            selectedId={selectedId}
            newCampaignId={campaignId}
            newClassId={classId}
            onSelect={setSelectedId}
            onCreate={openWizard}
            onDelete={deleteCharacter}
            onCampaignChange={handleCampaignChange}
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