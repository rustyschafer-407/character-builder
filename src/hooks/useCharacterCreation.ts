import { useMemo, useState } from "react";
import type {
  AttributeKey,
  CampaignDefinition,
  ClassItemChoiceRule,
  ClassDefinition,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  GameData,
} from "../types/gameData";
import type { CharacterCreationDraft } from "../components/CharacterCreationWizard";
import {
  areItemRulesSatisfiedAtMost,
  arePowerRulesSatisfiedExactly,
  areSkillRulesSatisfiedExactly,
  getRuleForItem,
  getRuleForPower,
  getRuleForSkill,
  getSelectedCountForItemRule,
  getSelectedCountForPowerRule,
  getSelectedCountForSkillRule,
} from "../lib/creationChoiceRules";
import { syncDerivedAttacks } from "../lib/attackSync";
import { getClassById, getClassesForCampaign } from "../lib/character";

type AttributeGenerationMethod = "pointBuy" | "randomRoll" | "manual";
type ClassChoiceRule = ClassSkillChoiceRule | ClassPowerChoiceRule | ClassItemChoiceRule;

function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) =>
    a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
  );
}

function getAttributeModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function getDraftHpForCon(hitDie: number, conScore: number) {
  const nextMax = Math.max(1, hitDie + getAttributeModifier(conScore));
  return {
    max: nextMax,
  };
}

function getAllowedIds<T extends ClassChoiceRule>(
  rules: T[],
  selectedIds: string[],
  defaultIds: string[] = []
) {
  if (rules.length === 0) {
    return new Set([...selectedIds, ...defaultIds]);
  }

  return new Set([
    ...selectedIds,
    ...defaultIds,
    ...rules.flatMap((rule) => ruleIds(rule)),
  ]);
}

function ruleIds(rule: ClassChoiceRule) {
  if ("skillIds" in rule) return rule.skillIds;
  if ("powerIds" in rule) return rule.powerIds;
  return rule.itemIds;
}

interface UseCharacterCreationParams {
  gameData: GameData;
  campaignId: string;
  classId: string;
  getCampaignName: (id: string) => string;
  makeDraftFromCampaignAndClass: (
    gameData: GameData,
    campaignId: string,
    classId: string,
    name: string
  ) => CharacterCreationDraft | null;
  makeBaseAttributes: () => Record<AttributeKey, number>;
  applyClassAttributeModifiers: (
    attributes: Record<AttributeKey, number>,
    cls: { attributeBonuses?: Array<{ attribute: AttributeKey; amount: number }> } | null
  ) => Record<AttributeKey, number>;
  getPointBuySpent: (attributes: Record<AttributeKey, number>) => number;
  onFinishDraft: (draft: CharacterCreationDraft) => void;
}

export function useCharacterCreation({
  gameData,
  campaignId,
  classId,
  getCampaignName,
  makeDraftFromCampaignAndClass,
  makeBaseAttributes,
  applyClassAttributeModifiers,
  getPointBuySpent,
  onFinishDraft,
}: UseCharacterCreationParams) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [creationDraft, setCreationDraft] = useState<CharacterCreationDraft | null>(null);

  const wizardCampaign: CampaignDefinition | null = useMemo(
    () =>
      creationDraft
        ? gameData.campaigns.find((campaign) => campaign.id === creationDraft.campaignId) ?? null
        : null,
    [creationDraft, gameData.campaigns]
  );

  const wizardClass: ClassDefinition | null = useMemo(
    () => (creationDraft ? getClassById(gameData, creationDraft.classId) ?? null : null),
    [creationDraft, gameData]
  );

  const wizardClassesForCampaign = useMemo(
    () =>
      creationDraft
        ? getClassesForCampaign(gameData, creationDraft.campaignId)
        : [],
    [creationDraft, gameData]
  );

  const wizardSkillChoiceRules = wizardClass?.skillChoiceRules ?? [];
  const wizardPowerChoiceRules = wizardClass?.powerChoiceRules ?? [];
  const wizardItemChoiceRules = wizardClass?.itemChoiceRules ?? [];

  const wizardSkills = useMemo(() => {
    if (!wizardCampaign || !creationDraft) return [];

    const allowedSkillIds = getAllowedIds(
      wizardSkillChoiceRules,
      creationDraft.skills.filter((skill) => skill.proficient).map((skill) => skill.skillId)
    );

    return sortByName(wizardCampaign.skills.filter((skill) => allowedSkillIds.has(skill.id)));
  }, [creationDraft, wizardCampaign, wizardSkillChoiceRules]);

  const wizardPowers = useMemo(() => {
    if (!wizardCampaign || !creationDraft) return [];

    const allowedPowerIds = getAllowedIds(
      wizardPowerChoiceRules,
      creationDraft.powers.flatMap((power) => (power.powerId ? [power.powerId] : [])),
      wizardClass?.defaultPowerIds ?? []
    );

    return sortByName(wizardCampaign.powers.filter((power) => allowedPowerIds.has(power.id)));
  }, [creationDraft, wizardCampaign, wizardClass?.defaultPowerIds, wizardPowerChoiceRules]);

  const wizardItems = useMemo(() => {
    if (!wizardCampaign || !creationDraft) return [];

    const allowedItemIds = getAllowedIds(
      wizardItemChoiceRules,
      creationDraft.inventory.flatMap((item) => (item.itemId ? [item.itemId] : [])),
      wizardClass?.defaultItemIds ?? []
    );

    return sortByName(wizardCampaign.items.filter((item) => allowedItemIds.has(item.id)));
  }, [creationDraft, wizardCampaign, wizardClass?.defaultItemIds, wizardItemChoiceRules]);

  const wizardPointBuyTotal =
    creationDraft?.attributeGeneration?.pointBuyTotal ??
    wizardCampaign?.attributeRules.pointBuyTotal ??
    27;

  const wizardPointBuySpent = creationDraft ? getPointBuySpent(creationDraft.attributes) : 0;
  const wizardPointBuyRemaining = wizardPointBuyTotal - wizardPointBuySpent;

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
      `${getCampaignName(defaultCampaignId)} Character`
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
    onFinishDraft(creationDraft);
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
      return areSkillRulesSatisfiedExactly(wizardSkillChoiceRules, creationDraft.skills);
    }

    if (wizardStep === 4) {
      return arePowerRulesSatisfiedExactly(wizardPowerChoiceRules, creationDraft.powers);
    }

    if (wizardStep === 5) {
      return areItemRulesSatisfiedAtMost(wizardItemChoiceRules, creationDraft.inventory);
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

      const nextHp = getDraftHpForCon(
        wizardClass?.hpRule.hitDie ?? creationDraft.hp.hitDie ?? 8,
        nextAttributes.CON
      );

      setCreationDraft({
        ...creationDraft,
        attributes: nextAttributes,
        hp: {
          ...creationDraft.hp,
          max: nextHp.max,
          current: Math.min(nextHp.max, creationDraft.hp.current + (nextHp.max - creationDraft.hp.max)),
        },
      });
      return;
    }

    const nextAttributes = {
      ...creationDraft.attributes,
      [key]: value,
    };
    const nextHp = getDraftHpForCon(
      wizardClass?.hpRule.hitDie ?? creationDraft.hp.hitDie ?? 8,
      nextAttributes.CON
    );

    setCreationDraft({
      ...creationDraft,
      attributes: nextAttributes,
      hp: {
        ...creationDraft.hp,
        max: nextHp.max,
        current: Math.min(nextHp.max, creationDraft.hp.current + (nextHp.max - creationDraft.hp.max)),
      },
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
      const selectedCount = getSelectedCountForSkillRule(rule, creationDraft.skills);
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

      const selectedCount = getSelectedCountForPowerRule(rule, creationDraft.powers);

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
        attacks: syncDerivedAttacks(
          {
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
          },
          wizardCampaign
        ),
      });
      return;
    }

    const nextPowers = creationDraft.powers.filter((p) => p.powerId !== powerId);
    setCreationDraft({
      ...creationDraft,
      powers: nextPowers,
      attacks: syncDerivedAttacks(
        {
          ...creationDraft,
          powers: nextPowers,
        },
        wizardCampaign
      ),
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

      const selectedCount = getSelectedCountForItemRule(rule, creationDraft.inventory);

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
        attacks: syncDerivedAttacks(
          {
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
          },
          wizardCampaign
        ),
      });
      return;
    }

    const nextInventory = creationDraft.inventory.filter((i) => i.itemId !== itemId);
    setCreationDraft({
      ...creationDraft,
      inventory: nextInventory,
      attacks: syncDerivedAttacks(
        {
          ...creationDraft,
          inventory: nextInventory,
        },
        wizardCampaign
      ),
    });
  }

  function handleWizardCampaignChange(nextCampaignId: string) {
    if (!creationDraft) return;
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
  }

  function handleWizardClassChange(nextClassId: string) {
    if (!creationDraft) return;
    const nextDraft = makeDraftFromCampaignAndClass(
      gameData,
      creationDraft.campaignId,
      nextClassId,
      creationDraft.identity.name
    );
    if (nextDraft) {
      setCreationDraft(nextDraft);
    }
  }

  function handleWizardAttributeGenerationChange(method: AttributeGenerationMethod) {
    if (!creationDraft) return;
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
    });
  }

  function handleWizardRollAttributes() {
    if (!creationDraft) return;
    const values = Array.from({ length: 6 }).map(() => {
      const dice = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1);
      dice.sort((a, b) => b - a);
      return dice[0] + dice[1] + dice[2];
    });

    const rolledAttributes = { ...creationDraft.attributes };
    const attrs: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
    attrs.forEach((attr, i) => {
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
  }

  function setWizardName(name: string) {
    if (!creationDraft) return;
    setCreationDraft({
      ...creationDraft,
      identity: {
        ...creationDraft.identity,
        name,
      },
    });
  }

  return {
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
  };
}
