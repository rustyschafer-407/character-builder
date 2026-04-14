import type {
  CharacterItem,
  CharacterPowerSelection,
  CharacterSkillSelection,
} from "../types/character";
import type {
  ClassItemChoiceRule,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
} from "../types/gameData";

export interface ChoiceOptionState {
  selectedCount: number;
  remaining: number;
  canBeChosen: boolean;
  disabled: boolean;
}

export function getRuleForSkill(skillId: string, rules: ClassSkillChoiceRule[]) {
  return rules.find((rule) => rule.skillIds.includes(skillId));
}

export function getSelectedCountForSkillRule(
  rule: ClassSkillChoiceRule,
  skills: CharacterSkillSelection[]
) {
  return skills.filter((skill) => rule.skillIds.includes(skill.skillId) && skill.proficient).length;
}

export function getSkillChoiceState(
  skillId: string,
  isSelected: boolean,
  selectedSkills: CharacterSkillSelection[],
  rules: ClassSkillChoiceRule[]
): ChoiceOptionState {
  const rule = getRuleForSkill(skillId, rules);
  const selectedCount = rule ? getSelectedCountForSkillRule(rule, selectedSkills) : 0;
  const remaining = rule ? rule.choose - selectedCount : 0;
  const canBeChosen = rules.length === 0 || Boolean(rule) || isSelected;
  const disabled =
    !isSelected && ((rules.length > 0 && !canBeChosen) || (rule ? remaining <= 0 : false));

  return {
    selectedCount,
    remaining,
    canBeChosen,
    disabled,
  };
}

export function getRuleForPower(powerId: string, rules: ClassPowerChoiceRule[]) {
  return rules.find((rule) => rule.powerIds.includes(powerId));
}

export function getSelectedCountForPowerRule(
  rule: ClassPowerChoiceRule,
  powers: CharacterPowerSelection[]
) {
  return powers.filter(
    (power) =>
      power.source === "wizard-choice" &&
      power.powerId &&
      rule.powerIds.includes(power.powerId)
  ).length;
}

export function getPowerChoiceState(
  powerId: string,
  isSelected: boolean,
  selectedPowers: CharacterPowerSelection[],
  rules: ClassPowerChoiceRule[]
): ChoiceOptionState {
  const rule = getRuleForPower(powerId, rules);
  const selectedCount = rule ? getSelectedCountForPowerRule(rule, selectedPowers) : 0;
  const remaining = rule ? rule.choose - selectedCount : 0;
  const canBeChosen = rules.length === 0 || Boolean(rule) || isSelected;
  const disabled =
    !isSelected && ((rules.length > 0 && !canBeChosen) || (rule ? remaining <= 0 : false));

  return {
    selectedCount,
    remaining,
    canBeChosen,
    disabled,
  };
}

export function getRuleForItem(itemId: string, rules: ClassItemChoiceRule[]) {
  return rules.find((rule) => rule.itemIds.includes(itemId));
}

export function getSelectedCountForItemRule(
  rule: ClassItemChoiceRule,
  inventory: CharacterItem[]
) {
  return inventory.filter((item) => item.itemId && rule.itemIds.includes(item.itemId)).length;
}

export function getItemChoiceState(
  itemId: string,
  isSelected: boolean,
  selectedItems: CharacterItem[],
  rules: ClassItemChoiceRule[]
): ChoiceOptionState {
  const rule = getRuleForItem(itemId, rules);
  const selectedCount = rule ? getSelectedCountForItemRule(rule, selectedItems) : 0;
  const remaining = rule ? rule.choose - selectedCount : 0;
  const canBeChosen = rules.length === 0 || Boolean(rule) || isSelected;
  const disabled =
    !isSelected && ((rules.length > 0 && !canBeChosen) || (rule ? remaining <= 0 : false));

  return {
    selectedCount,
    remaining,
    canBeChosen,
    disabled,
  };
}

export function areSkillRulesSatisfiedExactly(
  rules: ClassSkillChoiceRule[],
  selectedSkills: CharacterSkillSelection[]
) {
  return rules.every((rule) => getSelectedCountForSkillRule(rule, selectedSkills) === rule.choose);
}

export function arePowerRulesSatisfiedExactly(
  rules: ClassPowerChoiceRule[],
  selectedPowers: CharacterPowerSelection[]
) {
  return rules.every((rule) => getSelectedCountForPowerRule(rule, selectedPowers) === rule.choose);
}

export function areItemRulesSatisfiedAtMost(
  rules: ClassItemChoiceRule[],
  selectedItems: CharacterItem[]
) {
  return rules.every((rule) => getSelectedCountForItemRule(rule, selectedItems) <= rule.choose);
}