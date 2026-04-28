import type { CharacterCreationDraft } from "../../components/CharacterCreationWizard";
import type {
  AttackTemplateDefinition,
  AttributeKey,
  CampaignDefinition,
  ClassDefinition,
  ItemDefinition,
  PowerDefinition,
  RaceDefinition,
  SkillDefinition,
} from "../../types/gameData";

export const NPC_IMPORT_FORMAT = "character-builder.npc-import";
export const NPC_IMPORT_VERSION = 1;

export type NpcImportWarningCode =
  | "unknown-fields"
  | "unsupported-fields"
  | "invalid-field"
  | "invalid-reference"
  | "duplicate-name"
  | "forced-character-type"
  | "missing-optional-reference"
  | "defaulted-value";

export interface NpcImportWarning {
  code: NpcImportWarningCode;
  message: string;
}

export interface NpcImportPayload {
  format: string;
  version: number;
  content: {
    skills?: NpcImportSkill[];
    powers?: NpcImportPower[];
    items?: NpcImportItem[];
    attacks?: NpcImportAttack[];
    races?: NpcImportRace[];
    classes?: NpcImportClass[];
    characters?: NpcImportCharacter[];
    [key: string]: unknown;
  };
}

export interface NpcImportSkill {
  name?: string;
  attribute?: string;
  description?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface NpcImportPower {
  name?: string;
  level?: number | string;
  description?: string;
  tags?: string[];
  isAttack?: boolean;
  usesPerDay?: number | string;
  saveAttribute?: string;
  sourceText?: string;
  [key: string]: unknown;
}

export interface NpcImportItem {
  name?: string;
  description?: string;
  isAttack?: boolean;
  stackable?: boolean;
  defaultQuantity?: number | string;
  tags?: string[];
  [key: string]: unknown;
}

export interface NpcImportAttack {
  name?: string;
  attribute?: string;
  damage?: string;
  bonus?: number | string;
  notes?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface NpcImportRace {
  name?: string;
  description?: string;
  attributeBonuses?: Array<{ attribute?: string; amount?: number | string }>;
  defaultPowerNames?: string[];
  availableClassNames?: string[];
  [key: string]: unknown;
}

export interface NpcImportClass {
  name?: string;
  description?: string;
  attributeBonuses?: Array<{ attribute?: string; amount?: number | string }>;
  hitDie?: number | string;
  hitDiceAtLevel1?: number | string;
  defaultPowerNames?: string[];
  defaultItemNames?: string[];
  startingAttackNames?: string[];
  skillChoiceRules?: Array<{ choose?: number | string; skillNames?: string[] }>;
  powerChoiceRules?: Array<{ choose?: number | string; powerNames?: string[] }>;
  itemChoiceRules?: Array<{ choose?: number | string; itemNames?: string[] }>;
  [key: string]: unknown;
}

export interface NpcImportCharacter {
  name?: string;
  type?: string;
  campaign?: string;
  race?: string;
  class?: string;
  level?: number | string;
  attributes?: Partial<Record<AttributeKey, number | string>>;
  skills?: string[];
  powers?: string[];
  items?: Array<string | { name?: string; quantity?: number | string; notes?: string }>;
  attacks?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface NpcImportPreview {
  payload: NpcImportPayload;
  warnings: NpcImportWarning[];
  toCreate: {
    skills: SkillDefinition[];
    powers: PowerDefinition[];
    items: ItemDefinition[];
    attacks: AttackTemplateDefinition[];
    races: RaceDefinition[];
    classes: ClassDefinition[];
  };
  toReuse: {
    skills: SkillDefinition[];
    powers: PowerDefinition[];
    items: ItemDefinition[];
    attacks: AttackTemplateDefinition[];
    races: RaceDefinition[];
    classes: ClassDefinition[];
  };
  characterPlan: {
    name: string;
    type: "npc";
    raceName?: string;
    className?: string;
    level?: number;
    attributes: Partial<Record<AttributeKey, number>>;
    skillNames: string[];
    powerNames: string[];
    itemNames: Array<{ name: string; quantity: number; notes?: string }>;
    attackNames: string[];
    notes?: string;
  };
  characterPlans: Array<{
    name: string;
    type: "npc";
    raceName?: string;
    className?: string;
    level?: number;
    attributes: Partial<Record<AttributeKey, number>>;
    skillNames: string[];
    powerNames: string[];
    itemNames: Array<{ name: string; quantity: number; notes?: string }>;
    attackNames: string[];
    notes?: string;
  }>;
}

export interface NpcImportApplyResult {
  campaign: CampaignDefinition;
  draft: CharacterCreationDraft;
  drafts: CharacterCreationDraft[];
  warnings: NpcImportWarning[];
}

export const NPC_IMPORT_SCHEMA_FIELDS = {
  skills: ["name", "attribute", "description", "tags"],
  powers: ["name", "level", "description", "tags", "isAttack", "usesPerDay", "saveAttribute", "sourceText"],
  items: ["name", "description", "isAttack", "stackable", "defaultQuantity", "tags"],
  attacks: ["name", "attribute", "damage", "bonus", "notes", "tags"],
  races: ["name", "description", "attributeBonuses", "defaultPowerNames", "availableClassNames"],
  classes: [
    "name",
    "description",
    "attributeBonuses",
    "hitDie",
    "hitDiceAtLevel1",
    "defaultPowerNames",
    "defaultItemNames",
    "startingAttackNames",
    "skillChoiceRules",
    "powerChoiceRules",
    "itemChoiceRules",
  ],
  characters: ["name", "type", "campaign", "race", "class", "level", "attributes", "skills", "powers", "items", "attacks", "notes"],
} as const;
