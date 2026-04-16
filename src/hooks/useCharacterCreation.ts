import { useMemo, useState } from "react";
import type {
  AttributeKey,
  CampaignDefinition,
  ClassItemChoiceRule,
  ClassDefinition,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  GameData,
  RaceDefinition,
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
import {
  getClassById,
  getClassesForCampaignAndRace,
  getRaceById,
  getRacesForCampaign,
  sortByName,
  getAttributeModifier,
} from "../lib/character";
import {
  getAttributeBonusTotals,
  getPointBuySpentFromTotals,
  makePointBuyBaseAttributes,
} from "../lib/pointBuy";

type AttributeGenerationMethod = "pointBuy" | "randomRoll" | "manual";
type ClassChoiceRule = ClassSkillChoiceRule | ClassPowerChoiceRule | ClassItemChoiceRule;

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
  raceId: string;
  classId: string;
  getCampaignName: (id: string) => string;
  makeDraftFromCampaignClassAndRace: (
    gameData: GameData,
    campaignId: string,
    raceId: string,
    classId: string,
    name: string
  ) => CharacterCreationDraft | null;
  makeBaseAttributes: () => Record<AttributeKey, number>;
  applyClassAttributeModifiers: (
    attributes: Record<AttributeKey, number>,
    cls: { attributeBonuses?: Array<{ attribute: AttributeKey; amount: number }> } | null,
    race: { attributeBonuses?: Array<{ attribute: AttributeKey; amount: number }> } | null
  ) => Record<AttributeKey, number>;
  onFinishDraft: (draft: CharacterCreationDraft) => void;
}

export function useCharacterCreation({
  gameData,
  campaignId,
  raceId,
  classId,
  getCampaignName,
  makeDraftFromCampaignClassAndRace,
  makeBaseAttributes,
  applyClassAttributeModifiers,
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

  const wizardRace: RaceDefinition | null = useMemo(
    () => (creationDraft ? getRaceById(gameData, creationDraft.raceId) ?? null : null),
    [creationDraft, gameData]
  );

  const wizardRacesForCampaign = useMemo(
    () => (creationDraft ? getRacesForCampaign(gameData, creationDraft.campaignId) : []),
    [creationDraft, gameData]
  );

  const wizardClassesForCampaign = useMemo(
    () =>
      creationDraft
        ? getClassesForCampaignAndRace(gameData, creationDraft.campaignId, creationDraft.raceId)
        : [],
    [creationDraft, gameData]
  );

  const wizardSkillChoiceRules = useMemo(
    () => wizardClass?.skillChoiceRules ?? [],
    [wizardClass?.skillChoiceRules]
  );
  const wizardPowerChoiceRules = useMemo(
    () => wizardClass?.powerChoiceRules ?? [],
    [wizardClass?.powerChoiceRules]
  );
  const wizardItemChoiceRules = useMemo(
    () => wizardClass?.itemChoiceRules ?? [],
    [wizardClass?.itemChoiceRules]
  );

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

  const wizardAttributeBonusTotals = useMemo(
    () => getAttributeBonusTotals(wizardClass, wizardRace),
    [wizardClass, wizardRace]
  );

  const wizardPointBuyTotal =
    creationDraft?.attributeGeneration?.pointBuyTotal ??
    wizardCampaign?.attributeRules.pointBuyTotal ??
    27;

  const wizardPointBuySpent = creationDraft
    ? getPointBuySpentFromTotals(creationDraft.attributes, wizardAttributeBonusTotals)
    : 0;
  const wizardPointBuyRemaining = wizardPointBuyTotal - wizardPointBuySpent;

  function openWizard() {
    const defaultCampaignId = campaignId || gameData.campaigns[0]?.id || "";
    const racesInCampaign = getRacesForCampaign(gameData, defaultCampaignId);
    const selectedRaceInCampaign = racesInCampaign.some((race) => race.id === raceId)
      ? raceId
      : "";
    const defaultRaceId = selectedRaceInCampaign || racesInCampaign[0]?.id || "";
    const classesInCampaign = getClassesForCampaignAndRace(gameData, defaultCampaignId, defaultRaceId);
    const selectedClassInCampaign = classesInCampaign.some((cls) => cls.id === classId)
      ? classId
      : "";
    const defaultClassId = selectedClassInCampaign || classesInCampaign[0]?.id || "";

    const draft = makeDraftFromCampaignClassAndRace(
      gameData,
      defaultCampaignId,
      defaultRaceId,
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
      return Boolean(creationDraft.raceId);
    }

    if (wizardStep === 2) {
      return Boolean(creationDraft.classId);
    }

    if (wizardStep === 4) {
      const selectedSaveProfCount = Object.values(creationDraft.saveProf).filter(Boolean).length;
      return selectedSaveProfCount === 2;
    }

    if (wizardStep === 5) {
      return areSkillRulesSatisfiedExactly(wizardSkillChoiceRules, creationDraft.skills);
    }

    if (wizardStep === 6) {
      return arePowerRulesSatisfiedExactly(wizardPowerChoiceRules, creationDraft.powers);
    }

    if (wizardStep === 7) {
      return areItemRulesSatisfiedAtMost(wizardItemChoiceRules, creationDraft.inventory);
    }

    return true;
  }

  function nextWizardStep() {
    if (!validateWizardStep()) {
      alert("Please complete the required choices for this step before continuing.");
      return;
    }

    setWizardStep((prev) => Math.min(prev + 1, 8));
  }

  function previousWizardStep() {
    setWizardStep((prev) => Math.max(prev - 1, 0));
  }

  function updateWizardAttributeWithRules(key: AttributeKey, value: number) {
    if (!creationDraft) return;

    const method = creationDraft.attributeGeneration?.method ?? "pointBuy";

    if (method === "pointBuy") {
      const nextAttributes = {
        ...creationDraft.attributes,
        [key]: value,
      };
      const totalAllowed = creationDraft.attributeGeneration?.pointBuyTotal ?? 27;
      const spent = getPointBuySpentFromTotals(nextAttributes, wizardAttributeBonusTotals);

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

    if (method === "randomRoll") {
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

      if (wizardPowerChoiceRules.length > 0) {
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
    const nextRaceId = getRacesForCampaign(gameData, nextCampaignId)[0]?.id ?? "";
    const nextClassId = getClassesForCampaignAndRace(gameData, nextCampaignId, nextRaceId)[0]?.id ?? "";
    const nextDraft = makeDraftFromCampaignClassAndRace(
      gameData,
      nextCampaignId,
      nextRaceId,
      nextClassId,
      creationDraft.identity.name
    );
    if (nextDraft) {
      setCreationDraft(nextDraft);
    }
  }

  function handleWizardRaceChange(nextRaceId: string) {
    if (!creationDraft) return;
    const nextClassId = getClassesForCampaignAndRace(gameData, creationDraft.campaignId, nextRaceId)[0]?.id ?? "";
    const nextDraft = makeDraftFromCampaignClassAndRace(
      gameData,
      creationDraft.campaignId,
      nextRaceId,
      nextClassId,
      creationDraft.identity.name
    );
    if (nextDraft) {
      setCreationDraft(nextDraft);
    }
  }

  function handleWizardClassChange(nextClassId: string) {
    if (!creationDraft) return;
    const nextDraft = makeDraftFromCampaignClassAndRace(
      gameData,
      creationDraft.campaignId,
      creationDraft.raceId,
      nextClassId,
      creationDraft.identity.name
    );
    if (nextDraft) {
      setCreationDraft(nextDraft);
    }
  }

  function handleWizardAttributeGenerationChange(method: AttributeGenerationMethod) {
    if (!creationDraft) return;

    const nextAttributes =
      method === "manual"
        ? creationDraft.attributes
        : method === "pointBuy"
        ? applyClassAttributeModifiers(makePointBuyBaseAttributes(), wizardClass, wizardRace)
        : applyClassAttributeModifiers(makeBaseAttributes(), wizardClass, wizardRace);

    setCreationDraft({
      ...creationDraft,
      attributes: nextAttributes,
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

    const newAttributes = applyClassAttributeModifiers(rolledAttributes, wizardClass, wizardRace);

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

  function toggleWizardSaveProf(attribute: AttributeKey, nextSelected: boolean) {
    if (!creationDraft) return;

    const currentSelectedCount = Object.values(creationDraft.saveProf).filter(Boolean).length;
    if (nextSelected && !creationDraft.saveProf[attribute] && currentSelectedCount >= 2) {
      return;
    }

    setCreationDraft({
      ...creationDraft,
      saveProf: {
        ...creationDraft.saveProf,
        [attribute]: nextSelected,
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
  };
}
