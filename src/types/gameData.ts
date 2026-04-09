export type AttributeKey = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export interface AttributeBonusRule {
  attribute: AttributeKey;
  amount: number;
}

export interface CampaignLabels {
  attributes: string;
  skills: string;
  attacks: string;
  powers: string;
  inventory: string;
  className: string;
  level: string;
  hp: string;
}

export interface AttributeRules {
  generationMethods: Array<"pointBuy" | "randomRoll" | "manual">;
  pointBuyTotal?: number;
  randomRollFormula?: string;
  randomRollCount?: number;
  randomRollDropLowest?: number;
  minimumScore?: number;
  maximumScore?: number;
}

export interface CampaignDefinition {
  id: string;
  name: string;
  description?: string;
  labels: CampaignLabels;
  attributeRules: AttributeRules;
  classes: ClassDefinition[];
  skills: SkillDefinition[];
  powers: PowerDefinition[];
  items: ItemDefinition[];
  attackTemplates: AttackTemplateDefinition[];
  availableClassIds?: string[];
  availableSkillIds?: string[];
  availablePowerIds?: string[];
  availableItemIds?: string[];
  availableAttackTemplateIds?: string[];
}

export interface ClassSkillChoiceRule {
  choose: number;
  skillIds: string[];
}

export interface ClassPowerChoiceRule {
  choose: number;
  powerIds: string[];
}

export interface ClassItemChoiceRule {
  choose: number;
  itemIds: string[];
}

export interface HpRule {
  hitDie: number;
  level1Mode: "fixed-max" | "fixed-value" | "roll";
  level1FixedValue?: number;
  levelUpMode: "fixed-average" | "fixed-value" | "roll";
  levelUpFixedValue?: number;
}

export interface ClassDefinition {
  id: string;
  campaignId: string;
  name: string;
  description?: string;
  attributeBonuses: AttributeBonusRule[];
  hpRule: HpRule;
  startingAttackTemplateIds?: string[];
  defaultPowerIds?: string[];
  defaultItemIds?: string[];
  skillChoiceRules?: ClassSkillChoiceRule[];
  powerChoiceRules?: ClassPowerChoiceRule[];
  itemChoiceRules?: ClassItemChoiceRule[];
  levelUpSkillChoiceRules?: ClassSkillChoiceRule[];
  levelUpPowerChoiceRules?: ClassPowerChoiceRule[];
  levelUpItemChoiceRules?: ClassItemChoiceRule[];
}

export interface SkillDefinition {
  id: string;
  name: string;
  attribute: AttributeKey;
  description?: string;
  tags?: string[];
}

export interface PowerDefinition {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  category?: string;
  sourceText?: string;
}

export interface ItemDefinition {
  id: string;
  name: string;
  description?: string;
  category?: string;
  stackable: boolean;
  defaultQuantity?: number;
  tags?: string[];
}

export interface AttackTemplateDefinition {
  id: string;
  name: string;
  attribute: AttributeKey;
  damage: string;
  bonus?: number;
  notes?: string;
  tags?: string[];
}

export interface GameData {
  campaigns: CampaignDefinition[];
  classes: ClassDefinition[];
  skills: SkillDefinition[];
  powers: PowerDefinition[];
  items: ItemDefinition[];
  attackTemplates: AttackTemplateDefinition[];
}