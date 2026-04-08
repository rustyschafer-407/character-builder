import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { gameData as seedGameData } from "./data/gameData";
import {
  createCharacterFromCampaignAndClass,
  generateId,
  getClassById,
  getClassesForCampaign,
  touchCharacter,
} from "./lib/character";
import {
  buildRoll20AttributeMapJson,
  buildRoll20AttributeMapText,
} from "./lib/roll20Export";
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
import { buttonStyle, mutedTextStyle, pageStyle, panelStyle } from "./components/uiStyles";

const attributeKeySchema = z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);

const characterSkillSchema = z.object({
  skillId: z.string().min(1),
  proficient: z.boolean(),
  bonus: z.number(),
  source: z.enum(["campaign", "class", "background", "wizard-choice", "level-up", "manual"]),
});

const characterAttackSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().optional(),
  name: z.string(),
  attribute: attributeKeySchema,
  damage: z.string(),
  bonus: z.number(),
  damageBonus: z.number().optional(),
  notes: z.string().optional(),
});

const characterPowerSchema = z.object({
  powerId: z.string().optional(),
  name: z.string(),
  notes: z.string().optional(),
  source: z.enum(["campaign", "class", "background", "wizard-choice", "level-up", "manual"]),
});

const characterItemSchema = z.object({
  itemId: z.string().optional(),
  name: z.string(),
  quantity: z.number(),
  notes: z.string().optional(),
  equipped: z.boolean().optional(),
  source: z.enum(["campaign", "class", "background", "wizard-choice", "level-up", "manual"]),
});

const characterRecordSchema = z.object({
  id: z.string().min(1),
  identity: z.object({
    name: z.string(),
    playerName: z.string().optional(),
    notes: z.string().optional(),
    ancestry: z.string().optional(),
    background: z.string().optional(),
  }),
  campaignId: z.string().min(1),
  classId: z.string(),
  level: z.number(),
  proficiencyBonus: z.number(),
  attributes: z.object({
    STR: z.number(),
    DEX: z.number(),
    CON: z.number(),
    INT: z.number(),
    WIS: z.number(),
    CHA: z.number(),
  }),
  attributeGeneration: z
    .object({
      method: z.enum(["pointBuy", "randomRoll", "manual"]),
      rolls: z.array(z.number()).optional(),
      pointBuyTotal: z.number().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  hp: z.object({
    max: z.number(),
    current: z.number(),
    temp: z.number().optional(),
    hitDie: z.number().optional(),
    notes: z.string().optional(),
  }),
  sheet: z
    .object({
      speed: z.string().optional(),
      acBase: z.number(),
      acBonus: z.number(),
      acUseDex: z.boolean(),
      initMisc: z.number(),
      saveProf: z.object({
        STR: z.boolean(),
        DEX: z.boolean(),
        CON: z.boolean(),
        INT: z.boolean(),
        WIS: z.boolean(),
        CHA: z.boolean(),
      }),
      saveBonus: z.object({
        STR: z.number(),
        DEX: z.number(),
        CON: z.number(),
        INT: z.number(),
        WIS: z.number(),
        CHA: z.number(),
      }),
    })
    .optional(),
  skills: z.array(characterSkillSchema),
  powers: z.array(characterPowerSchema),
  inventory: z.array(characterItemSchema),
  attacks: z.array(characterAttackSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

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

function getModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function formatModifier(score: number) {
  const mod = getModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function buildRoll20TransferText(character: CharacterRecord, gameData: GameData) {
  const campaign = gameData.campaigns.find((g) => g.id === character.campaignId);
  const cls = gameData.classes.find((c) => c.id === character.classId);

  const skillMap = new Map(gameData.skills.map((skill) => [skill.id, skill]));
  const powerMap = new Map(gameData.powers.map((power) => [power.id, power]));
  const itemMap = new Map(gameData.items.map((item) => [item.id, item]));

  const proficientSkills = character.skills.filter((skill) => skill.proficient);

  const lines = [
    "ROLL20 TRANSFER BLOCK",
    "====================",
    "",
    `Name: ${character.identity.name || ""}`,
    `Campaign: ${campaign?.name ?? character.campaignId}`,
    `Class: ${cls?.name ?? character.classId}`,
    `Level: ${character.level}`,
    `Proficiency Bonus: ${character.proficiencyBonus >= 0 ? "+" : ""}${character.proficiencyBonus}`,
    "",
    "ATTRIBUTES",
    `STR ${character.attributes.STR} (${formatModifier(character.attributes.STR)})`,
    `DEX ${character.attributes.DEX} (${formatModifier(character.attributes.DEX)})`,
    `CON ${character.attributes.CON} (${formatModifier(character.attributes.CON)})`,
    `INT ${character.attributes.INT} (${formatModifier(character.attributes.INT)})`,
    `WIS ${character.attributes.WIS} (${formatModifier(character.attributes.WIS)})`,
    `CHA ${character.attributes.CHA} (${formatModifier(character.attributes.CHA)})`,
    "",
    "HP",
    `Current: ${character.hp.current}`,
    `Max: ${character.hp.max}`,
    `Temp: ${character.hp.temp ?? 0}`,
    `Hit Die: d${character.hp.hitDie ?? 0}`,
    "",
    "SKILLS",
    ...(proficientSkills.length > 0
      ? proficientSkills.map((skill) => {
          const definition = skillMap.get(skill.skillId);
          const baseAttr = definition?.attribute ?? "STR";
          const total =
            getModifier(character.attributes[baseAttr]) +
            character.proficiencyBonus +
            skill.bonus;

          return `${definition?.name ?? skill.skillId}: ${total >= 0 ? "+" : ""}${total} (${baseAttr})`;
        })
      : ["None"]),
    "",
    "ATTACKS",
    ...(character.attacks.length > 0
      ? character.attacks.map((attack) => {
          const total =
            getModifier(character.attributes[attack.attribute]) + attack.bonus;
          const bonusText = total >= 0 ? `+${total}` : `${total}`;
          const damageBonusText = attack.damageBonus ? ` + ${attack.damageBonus}` : "";
          const notes = attack.notes?.trim() ? ` | ${attack.notes}` : "";
          return `${attack.name}: attack ${bonusText}, damage ${attack.damage}${damageBonusText}, attr ${attack.attribute}${notes}`;
        })
      : ["None"]),
    "",
    "POWERS",
    ...(character.powers.length > 0
      ? character.powers.map((power) => {
          const definition = power.powerId ? powerMap.get(power.powerId) : null;
          const notes = power.notes?.trim() || definition?.description || "";
          return notes ? `${power.name}: ${notes}` : power.name;
        })
      : ["None"]),
    "",
    "INVENTORY",
    ...(character.inventory.length > 0
      ? character.inventory.map((item) => {
          const definition = item.itemId ? itemMap.get(item.itemId) : null;
          const equipped = item.equipped ? " [equipped]" : "";
          const notes = item.notes?.trim() || definition?.description || "";
          return notes
            ? `${item.name} x${item.quantity}${equipped}: ${notes}`
            : `${item.name} x${item.quantity}${equipped}`;
        })
      : ["None"]),
    "",
    "NOTES",
    character.identity.notes?.trim() || "None",
  ];

  return lines.join("\n");
}

function makeDraftFromCampaignAndClass(
  gameData: GameData,
  campaignId: string,
  classId: string,
  name: string
) {
  const campaign = gameData.campaigns.find((g) => g.id === campaignId);
  const cls = gameData.classes.find((c) => c.id === classId);
  if (!campaign || !cls) return null;

  const base = createCharacterFromCampaignAndClass(gameData, campaign, cls, name);

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
  const [roll20PreviewMode, setRoll20PreviewMode] = useState<"text" | "json">("text");

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

  const selectedSkills = selectedCampaign
    ? gameData.skills.filter((skill) => selectedCampaign.availableSkillIds.includes(skill.id))
    : [];

  const selectedPowers = selectedCampaign
    ? gameData.powers.filter((power) => selectedCampaign.availablePowerIds.includes(power.id))
    : [];

  const selectedItems = selectedCampaign
    ? gameData.items.filter((item) => selectedCampaign.availableItemIds.includes(item.id))
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

  const wizardSkills = wizardCampaign
    ? gameData.skills.filter((skill) => wizardCampaign.availableSkillIds.includes(skill.id))
    : [];

  const wizardPowers = wizardCampaign
    ? gameData.powers.filter((power) => wizardCampaign.availablePowerIds.includes(power.id))
    : [];

  const wizardItems = wizardCampaign
    ? gameData.items.filter((item) => wizardCampaign.availableItemIds.includes(item.id))
    : [];

  const wizardSkillChoiceRules = wizardClass?.skillChoiceRules ?? [];
  const wizardPowerChoiceRules = wizardClass?.powerChoiceRules ?? [];
  const wizardItemChoiceRules = wizardClass?.itemChoiceRules ?? [];

  const wizardPointBuyTotal =
    creationDraft?.attributeGeneration?.pointBuyTotal ??
    wizardCampaign?.attributeRules.pointBuyTotal ??
    27;

  const wizardPointBuySpent = creationDraft ? getPointBuySpent(creationDraft.attributes) : 0;
  const wizardPointBuyRemaining = wizardPointBuyTotal - wizardPointBuySpent;

  const roll20PreviewText = selected ? buildRoll20AttributeMapText(selected, gameData) : "";
  const roll20PreviewJson = selected ? buildRoll20AttributeMapJson(selected, gameData) : "";

  function getCampaignName(id: string) {
    return gameData.campaigns.find((g) => g.id === id)?.name ?? id;
  }

  function getClassName(id: string) {
    return (gameData.classes.find((cls) => cls.id === id)?.name ?? id) || "Unassigned";
  }

  function openWizard() {
    const defaultCampaignId = campaignId || gameData.campaigns[0]?.id || "";
    const defaultClassId = getClassesForCampaign(gameData, defaultCampaignId)[0]?.id ?? "";

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
        return count === rule.choose;
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
    const power = gameData.powers.find((p) => p.id === powerId);
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
    if (!creationDraft) return;

    const power = gameData.powers.find((p) => p.id === powerId);
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
    const item = gameData.items.find((i) => i.id === itemId);
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
    if (!creationDraft) return;

    const item = gameData.items.find((i) => i.id === itemId);
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

  function exportCharacter(character: CharacterRecord) {
    const data = JSON.stringify(character, null, 2);
    const blob = new Blob([data], { type: "application/json" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character.identity.name || "character"}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async function copyRoll20Transfer(character: CharacterRecord) {
    try {
      const text = buildRoll20TransferText(character, gameData);
      await navigator.clipboard.writeText(text);
      alert("Roll20 transfer text copied to clipboard.");
    } catch {
      alert("Could not copy to clipboard on this device/browser.");
    }
  }

  function downloadRoll20Transfer(character: CharacterRecord) {
    const text = buildRoll20TransferText(character, gameData);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character.identity.name || "character"}-roll20-transfer.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyRoll20AttributeMap(character: CharacterRecord) {
    try {
      const text = buildRoll20AttributeMapText(character, gameData);
      await navigator.clipboard.writeText(text);
      alert("Roll20 attribute map copied to clipboard.");
    } catch {
      alert("Could not copy Roll20 attribute map to clipboard on this device/browser.");
    }
  }

  async function copyCurrentPreview() {
    if (!selected) return;

    const text = roll20PreviewMode === "text" ? roll20PreviewText : roll20PreviewJson;

    try {
      await navigator.clipboard.writeText(text);
      alert("Preview copied to clipboard.");
    } catch {
      alert("Could not copy preview to clipboard on this device/browser.");
    }
  }

  function downloadRoll20AttributeMapText(character: CharacterRecord) {
    const text = buildRoll20AttributeMapText(character, gameData);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character.identity.name || "character"}-roll20-attribute-map.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadRoll20AttributeMapJsonFile(character: CharacterRecord) {
    const json = buildRoll20AttributeMapJson(character, gameData);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${character.identity.name || "character"}-roll20-attribute-map.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCharacter(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        const parsed = characterRecordSchema.parse(raw);

        const campaignExists = gameData.campaigns.some((g) => g.id === parsed.campaignId);
        if (!campaignExists) {
          alert(`Import failed: unknown campaign "${parsed.campaignId}".`);
          return;
        }

        const idAlreadyExists = characters.some((c) => c.id === parsed.id);

        const importedCharacter: CharacterRecord = {
          ...parsed,
          sheet: parsed.sheet ?? {
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
          id: idAlreadyExists ? generateId() : parsed.id,
          updatedAt: new Date().toISOString(),
        };

        setCharacters((prev) => [...prev, importedCharacter]);
        setSelectedId(importedCharacter.id);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const firstIssue = error.issues[0];
          const path = firstIssue?.path?.join(".") || "file";
          alert(`Import failed: invalid character data at "${path}".`);
          return;
        }

        alert("Import failed: invalid JSON file.");
      }
    };

    reader.readAsText(file);
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
            color: "#111827",
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
            onImport={importCharacter}
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

                  const attrs: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
                  const newAttributes = { ...creationDraft.attributes };

                  attrs.forEach((attr, i) => {
                    newAttributes[attr] = values[i];
                  });

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
              <section style={panelStyle}>
                <h3 style={{ marginTop: 0, color: "#111827" }}>Roll20 Export</h3>
                <p style={{ marginTop: 0, color: "#4b5563" }}>
                  The transfer text is human-friendly. The attribute map is a more exact field-style
                  export for your custom sheet and future automation.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => copyRoll20Transfer(selected)} style={buttonStyle}>
                    Copy Roll20 Transfer Text
                  </button>
                  <button onClick={() => downloadRoll20Transfer(selected)} style={buttonStyle}>
                    Download Roll20 Transfer Text
                  </button>
                  <button onClick={() => copyRoll20AttributeMap(selected)} style={buttonStyle}>
                    Copy Roll20 Attribute Map
                  </button>
                  <button
                    onClick={() => {
                      setRoll20PreviewMode("text");
                      setRoll20PreviewOpen(true);
                    }}
                    style={buttonStyle}
                  >
                    Preview Attribute Map
                  </button>
                  <button
                    onClick={() => {
                      setRoll20PreviewMode("json");
                      setRoll20PreviewOpen(true);
                    }}
                    style={buttonStyle}
                  >
                    Preview JSON
                  </button>
                  <button onClick={() => downloadRoll20AttributeMapText(selected)} style={buttonStyle}>
                    Download Attribute Map TXT
                  </button>
                  <button onClick={() => downloadRoll20AttributeMapJsonFile(selected)} style={buttonStyle}>
                    Download Attribute Map JSON
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
                onExport={() => exportCharacter(selected)}
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
              background: "#ffffff",
              borderRadius: 14,
              border: "1px solid #d1d5db",
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
                <h2 style={{ margin: 0, color: "#111827" }}>Roll20 Export Preview</h2>
                <div style={{ color: "#6b7280", marginTop: 4 }}>
                  {selected.identity.name || "Unnamed Character"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setRoll20PreviewMode("text")}
                  style={{
                    ...buttonStyle,
                    background: roll20PreviewMode === "text" ? "#dbeafe" : buttonStyle.background,
                    border:
                      roll20PreviewMode === "text"
                        ? "1px solid #93c5fd"
                        : buttonStyle.border,
                  }}
                >
                  Attribute Map
                </button>
                <button
                  onClick={() => setRoll20PreviewMode("json")}
                  style={{
                    ...buttonStyle,
                    background: roll20PreviewMode === "json" ? "#dbeafe" : buttonStyle.background,
                    border:
                      roll20PreviewMode === "json"
                        ? "1px solid #93c5fd"
                        : buttonStyle.border,
                  }}
                >
                  JSON
                </button>
                <button onClick={copyCurrentPreview} style={buttonStyle}>
                  Copy Preview
                </button>
                <button onClick={() => setRoll20PreviewOpen(false)} style={buttonStyle}>
                  Close
                </button>
              </div>
            </div>

            <textarea
              readOnly
              value={roll20PreviewMode === "text" ? roll20PreviewText : roll20PreviewJson}
              style={{
                width: "100%",
                minHeight: 500,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                padding: 14,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                fontSize: 13,
                lineHeight: 1.5,
                color: "#111827",
                background: "#f8fafc",
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