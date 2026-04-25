import type { AttributeKey } from "./gameData";

export type CharacterType = "pc" | "npc";

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
  attribute?: AttributeKey;
  proficient: boolean;
  bonus: number;
  source: "campaign" | "class" | "background" | "wizard-choice" | "level-up" | "manual";
}

export interface CharacterAttack {
  id: string;
  templateId?: string;
  derivedFromType?: "power" | "item";
  derivedFromId?: string;
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
  usesPerDay?: number;
  description?: string;
  saveAttribute?: AttributeKey;
}

export interface CharacterItem {
  itemId?: string;
  name: string;
  quantity: number;
  notes?: string;
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
  characterType?: CharacterType;
  identity: CharacterIdentity;
  campaignId: string;
  raceId?: string;
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
  /** User ID of the character creator. Used for ownership-based perms. */
  createdBy?: string | null;
}