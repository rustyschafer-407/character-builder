import type {
  CharacterAttack,
  CharacterAttributeGeneration,
  CharacterHp,
  CharacterIdentity,
  CharacterItem,
  CharacterPowerSelection,
  CharacterRecord,
  CharacterSkillSelection,
} from "../types/character";
import type {
  AttributeKey,
  CampaignDefinition,
  ClassDefinition,
  GameData,
} from "../types/gameData";

export function generateId() {
  return crypto.randomUUID();
}

export function getAttributeModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function getClassesForCampaign(gameData: GameData, campaignId: string) {
  return gameData.classes.filter((cls) => cls.campaignId === campaignId);
}

export function getClassById(gameData: GameData, classId: string) {
  return gameData.classes.find((cls) => cls.id === classId);
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

function applyAttributeBonuses(
  attributes: Record<AttributeKey, number>,
  cls: ClassDefinition
): Record<AttributeKey, number> {
  const next = { ...attributes };

  for (const bonus of cls.attributeBonuses ?? []) {
    next[bonus.attribute] += bonus.amount;
  }

  return next;
}

function makeIdentity(name: string): CharacterIdentity {
  return {
    name,
    playerName: "",
    notes: "",
    ancestry: "",
    background: "",
  };
}

function makeAttributeGeneration(
  campaign: CampaignDefinition
): CharacterAttributeGeneration | undefined {
  const defaultMethod = campaign.attributeRules.generationMethods[0];
  if (!defaultMethod) return undefined;

  return {
    method: defaultMethod,
    pointBuyTotal: campaign.attributeRules.pointBuyTotal,
    rolls: [],
    notes: "",
  };
}

function makeHp(cls: ClassDefinition, conScore: number): CharacterHp {
  const conMod = getAttributeModifier(conScore);
  const hitDie = cls.hpRule.hitDie;

  let max = hitDie;

  if (cls.hpRule.level1Mode === "fixed-value" && cls.hpRule.level1FixedValue) {
    max = cls.hpRule.level1FixedValue;
  }

  if (cls.hpRule.level1Mode === "roll") {
    max = hitDie;
  }

  max += conMod;

  return {
    max,
    current: max,
    temp: 0,
    hitDie,
    notes: "",
  };
}

function makeSheetDefaults(): CharacterRecord["sheet"] {
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

function makeSkills(campaign: CampaignDefinition): CharacterSkillSelection[] {
  return campaign.availableSkillIds.map((skillId) => ({
    skillId,
    proficient: false,
    bonus: 0,
    source: "campaign",
  }));
}

function makePowers(gameData: GameData, cls: ClassDefinition): CharacterPowerSelection[] {
  return (cls.defaultPowerIds ?? [])
    .map((powerId) => gameData.powers.find((power) => power.id === powerId))
    .filter((power): power is NonNullable<typeof power> => Boolean(power))
    .map((power) => ({
      powerId: power.id,
      name: power.name,
      notes: power.description ?? "",
      source: "class",
    }));
}

function makeItems(gameData: GameData, cls: ClassDefinition): CharacterItem[] {
  return (cls.defaultItemIds ?? [])
    .map((itemId) => gameData.items.find((item) => item.id === itemId))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      quantity: item.defaultQuantity ?? 1,
      notes: item.description ?? "",
      equipped: false,
      source: "class",
    }));
}

function makeAttacks(gameData: GameData, cls: ClassDefinition): CharacterAttack[] {
  return (cls.startingAttackTemplateIds ?? [])
    .map((templateId) =>
      gameData.attackTemplates.find((template) => template.id === templateId)
    )
    .filter((template): template is NonNullable<typeof template> => Boolean(template))
    .map((template) => ({
      id: generateId(),
      templateId: template.id,
      name: template.name,
      attribute: template.attribute,
      damage: template.damage,
      bonus: template.bonus ?? 0,
      damageBonus: 0,
      notes: template.notes ?? "",
    }));
}

export function createCharacterFromCampaignAndClass(
  gameData: GameData,
  campaign: CampaignDefinition,
  cls: ClassDefinition,
  name: string
): CharacterRecord {
  const baseAttributes = makeBaseAttributes();
  const attributes = applyAttributeBonuses(baseAttributes, cls);

  const createdAt = new Date().toISOString();

  return {
    id: generateId(),
    identity: makeIdentity(name),
    campaignId: campaign.id,
    classId: cls.id,
    level: 1,
    proficiencyBonus: 2,
    attributes,
    attributeGeneration: makeAttributeGeneration(campaign),
    hp: makeHp(cls, attributes.CON),
    sheet: makeSheetDefaults(),
    skills: makeSkills(campaign),
    powers: makePowers(gameData, cls),
    inventory: makeItems(gameData, cls),
    attacks: makeAttacks(gameData, cls),
    createdAt,
    updatedAt: createdAt,
  };
}

export function touchCharacter(character: CharacterRecord): CharacterRecord {
  return {
    ...character,
    updatedAt: new Date().toISOString(),
  };
}