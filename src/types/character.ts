import type { AttributeKey } from "./gameData";

export interface CharacterIdentity {
  name: string;
  playerName?: string;
  notes?: string;
  ancestry?: string;
  background?: string;
}

export interface CharacterAttributeGeneration {
  method: "pointBuy" | "randomRoll" | "manual";
  pointBuyTotal?: number;
  rolls?: number[];
  notes?: string;
}

export interface CharacterHp {
  max: number;
  current: number;
  temp?: number;
  hitDie?: number;
  notes?: string;
}

export interface CharacterSkillSelection {
  skillId: string;
  proficient: boolean;
  bonus: number;
  source: "campaign" | "class" | "background" | "wizard-choice" | "level-up" | "manual";
}

export interface CharacterAttack {
  id: string;
  templateId?: string;
  name: string;
  attribute: AttributeKey;
  damage: string;
  bonus: number;
  damageBonus?: number;
  notes?: string;
}

export interface CharacterPowerSelection {
  powerId?: string;
  name: string;
  notes?: string;
  source: "campaign" | "class" | "background" | "wizard-choice" | "level-up" | "manual";
}

export interface CharacterItem {
  itemId?: string;
  name: string;
  quantity: number;
  notes?: string;
  equipped?: boolean;
  source: "campaign" | "class" | "background" | "wizard-choice" | "level-up" | "manual";
}

export interface CharacterSheetFields {
  speed?: string;
  acBase: number;
  acBonus: number;
  acUseDex: boolean;
  initMisc: number;
  saveProf: Record<AttributeKey, boolean>;
  saveBonus: Record<AttributeKey, number>;
}

export interface CharacterLevelProgressionState {
  totalHitDice: number;
  gainedSkillIds: string[];
  gainedPowerIds: string[];
  appliedLevels: number[];
  appliedAttributeIncreases: Record<AttributeKey, number>;
}

export interface CharacterRecord {
  id: string;
  identity: CharacterIdentity;
  campaignId: string;
  classId: string;
  level: number;
  proficiencyBonus: number;
  attributes: Record<AttributeKey, number>;
  attributeGeneration?: CharacterAttributeGeneration;
  hp: CharacterHp;
  sheet: CharacterSheetFields;
  skills: CharacterSkillSelection[];
  powers: CharacterPowerSelection[];
  inventory: CharacterItem[];
  attacks: CharacterAttack[];
  levelProgression: CharacterLevelProgressionState;
  createdAt: string;
  updatedAt: string;
}