import { useMemo, useState } from "react";
import {
  buildMissingProgressionMessage,
  getAllowedPowerIdsForLevelUp,
  getAllowedSkillIdsForLevelUp,
  getLevelUpHpGain,
  getNextLevelProgressionRow,
} from "../lib/progression";
import { sortByName } from "../lib/character";
import { syncDerivedAttacks } from "../lib/attackSync";
import type { CharacterRecord } from "../types/character";
import type {
  CampaignDefinition,
  ClassDefinition,
  ClassLevelProgressionRow,
  PowerDefinition,
  SkillDefinition,
} from "../types/gameData";

interface UseLevelUpWorkflowParams {
  selected: CharacterRecord | null;
  selectedCampaign: CampaignDefinition | null;
  selectedClass: ClassDefinition | null;
  onApplyUpdatedCharacter: (character: CharacterRecord) => void;
}

export function useLevelUpWorkflow({
  selected,
  selectedCampaign,
  selectedClass,
  onApplyUpdatedCharacter,
}: UseLevelUpWorkflowParams) {
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [levelUpApplyPending, setLevelUpApplyPending] = useState(false);
  const [levelUpSkillSelections, setLevelUpSkillSelections] = useState<string[]>([]);
  const [levelUpPowerSelections, setLevelUpPowerSelections] = useState<string[]>([]);
  const [levelUpMissingRowMessage, setLevelUpMissingRowMessage] = useState<string | null>(null);

  const nextLevelProgressionRow: ClassLevelProgressionRow | null = useMemo(
    () =>
      selected && selectedClass
        ? getNextLevelProgressionRow(selected, selectedClass.levelProgression)
        : null,
    [selected, selectedClass]
  );

  const selectedSkills: SkillDefinition[] = selectedCampaign ? selectedCampaign.skills : [];
  const selectedPowers: PowerDefinition[] = selectedCampaign ? selectedCampaign.powers : [];

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

  const sortedAvailableLevelUpSkills = sortByName(availableLevelUpSkills);
  const sortedAvailableLevelUpPowers = sortByName(availableLevelUpPowers);

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

  function toggleLevelUpSkill(skillId: string, nextSelected: boolean) {
    if (!nextLevelProgressionRow) return;
    const maxChoices = nextLevelProgressionRow.newSkillChoices;

    if (nextSelected) {
      if (levelUpSkillSelections.includes(skillId)) return;
      if (levelUpSkillSelections.length >= maxChoices) return;
      if (!sortedAvailableLevelUpSkills.some((skill) => skill.id === skillId)) return;
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
      if (!sortedAvailableLevelUpPowers.some((power) => power.id === powerId)) return;
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

    const availableSkillIdSet = new Set(sortedAvailableLevelUpSkills.map((skill) => skill.id));
    const availablePowerIdSet = new Set(sortedAvailableLevelUpPowers.map((power) => power.id));

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

    const nextPowers = [...selected.powers, ...addedPowers];

    const updated: CharacterRecord = {
      ...selected,
      level: selected.level + 1,
      proficiencyBonus: Number.isFinite(nextLevelProgressionRow.proficiencyBonus)
        ? Math.max(0, Math.floor(Number(nextLevelProgressionRow.proficiencyBonus)))
        : selected.proficiencyBonus,
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
      powers: nextPowers,
      attacks: syncDerivedAttacks(
        {
          ...selected,
          powers: nextPowers,
        },
        selectedCampaign
      ),
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

    onApplyUpdatedCharacter(updated);
    closeLevelUpWizard();
  }

  return {
    levelUpOpen,
    levelUpApplyPending,
    levelUpSkillSelections,
    levelUpPowerSelections,
    levelUpMissingRowMessage,
    nextLevelProgressionRow,
    availableLevelUpSkills: sortedAvailableLevelUpSkills,
    availableLevelUpPowers: sortedAvailableLevelUpPowers,
    openLevelUpWizard,
    closeLevelUpWizard,
    toggleLevelUpSkill,
    toggleLevelUpPower,
    applyLevelUp,
  };
}
