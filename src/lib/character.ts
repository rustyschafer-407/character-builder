import type {
  CharacterAttack,
  CharacterAttributeGeneration,
  CharacterHp,
  CharacterIdentity,
  CharacterItem,
  CharacterPowerSelection,
  CharacterRecord,
  CharacterType,
  CharacterSkillSelection,
} from "../types/character";
import type {
  AttributeKey,
  CampaignDefinition,
  ClassDefinition,
  GameData,
  RaceDefinition,
} from "../types/gameData";
import { syncDerivedAttacks } from "./attackSync";
import { findCampaign, findClassInCampaign, findRaceInCampaign, resolveCampaignAssets } from "./domain";

export function generateId() {
  return crypto.randomUUID();
}

export function getCharacterType(character: Pick<CharacterRecord, "characterType">): CharacterType {
  return character.characterType === "npc" ? "npc" : "pc";
}

export function getAttributeModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function getHitDiceAtLevel1(cls: Pick<ClassDefinition, "hpRule">) {
  const configured = cls.hpRule?.hitDiceAtLevel1;
  if (!Number.isFinite(configured)) return 1;
  return Math.max(1, Math.floor(Number(configured)));
}

export function sortByName<T extends { name: string }>(items: T[]) {
  return [...items].sort((a, b) =>
    a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
  );
}

export function getClassesForCampaign(gameData: GameData, campaignId: string) {
  const campaign = findCampaign(gameData, campaignId);
  return [...resolveCampaignAssets(campaign).classes].sort((a, b) =>
    a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
  );
}

export function getRacesForCampaign(gameData: GameData, campaignId: string) {
  const campaign = findCampaign(gameData, campaignId);
  return [...resolveCampaignAssets(campaign).races].sort((a, b) =>
    a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
  );
}

export function getClassesForCampaignAndRace(
  gameData: GameData,
  campaignId: string,
  raceId?: string
) {
  const campaign = findCampaign(gameData, campaignId);
  const classes = [...resolveCampaignAssets(campaign).classes];
  if (!raceId) {
    return classes.sort((a, b) =>
      a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
    );
  }

  const race = findRaceInCampaign(campaign, raceId);
  const allowedClassIds = race?.availableClassIds ?? [];
  if (allowedClassIds.length === 0) {
    return classes.sort((a, b) =>
      a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" })
    );
  }

  return classes
    .filter((cls) => allowedClassIds.includes(cls.id))
    .sort((a, b) => a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base" }));
}

export function getClassById(gameData: GameData, classId: string) {
  for (const campaign of gameData.campaigns) {
    const cls = findClassInCampaign(campaign, classId);
    if (cls) return cls;
  }
  return undefined;
}

export function getRaceById(gameData: GameData, raceId: string) {
  for (const campaign of gameData.campaigns) {
    const race = findRaceInCampaign(campaign, raceId);
    if (race) return race;
  }
  return undefined;
}

export function makeBaseAttributes(): Record<AttributeKey, number> {
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
  bonuses: Array<{ attribute: AttributeKey; amount: number }> | undefined
): Record<AttributeKey, number> {
  const next = { ...attributes };

  for (const bonus of bonuses ?? []) {
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
  const hitDiceAtLevel1 = getHitDiceAtLevel1(cls);
  const baseHp = hitDie * hitDiceAtLevel1;

  // Character creation is always the full hit die at level 1.
  // Positive CON can increase it, but negative CON should not reduce it below base level-1 HP.
  const max = Math.max(baseHp, baseHp + conMod);

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
    speed: "30",
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

function makeLevelProgressionDefaults(level: number, cls: ClassDefinition): CharacterRecord["levelProgression"] {
  const hitDiceAtLevel1 = getHitDiceAtLevel1(cls);
  return {
    totalHitDice: Math.max(hitDiceAtLevel1, level),
    gainedSkillIds: [],
    gainedPowerIds: [],
    appliedLevels: Array.from({ length: Math.max(1, level) }, (_value, index) => index + 1),
    appliedAttributeIncreases: {
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
  return campaign.skills.map((skill) => ({
    skillId: skill.id,
    attribute: skill.attribute,
    proficient: false,
    bonus: 0,
    source: "campaign",
  }));
}

function makePowers(
  campaign: CampaignDefinition,
  cls: ClassDefinition,
  race: RaceDefinition | null
): CharacterPowerSelection[] {
  const defaultPowerIds = new Set([...(cls.defaultPowerIds ?? []), ...(race?.defaultPowerIds ?? [])]);

  return [...defaultPowerIds]
    .map((powerId) => campaign.powers.find((power) => power.id === powerId))
    .filter((power): power is NonNullable<typeof power> => Boolean(power))
    .filter((power) => (power.level ?? 1) <= 1)
    .map((power) => ({
      powerId: power.id,
      name: power.name,
      notes: power.description ?? "",
      source: race?.defaultPowerIds?.includes(power.id) ? "background" : "class",
    }));
}

function makeItems(): CharacterItem[] {
  // Items are now chosen by the user during character creation based on class rules
  return [];
}

function makeAttacks(campaign: CampaignDefinition, cls: ClassDefinition): CharacterAttack[] {
  return (cls.startingAttackTemplateIds ?? [])
    .map((templateId) => campaign.attackTemplates.find((template) => template.id === templateId))
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
  campaign: CampaignDefinition,
  cls: ClassDefinition,
  name: string,
  race: RaceDefinition | null = null
): CharacterRecord {
  const baseAttributes = makeBaseAttributes();
  const classAdjusted = applyAttributeBonuses(baseAttributes, cls.attributeBonuses);
  const attributes = applyAttributeBonuses(classAdjusted, race?.attributeBonuses);

  const createdAt = new Date().toISOString();

  const powers = makePowers(campaign, cls, race);
  const inventory = makeItems();
  const baseAttacks = makeAttacks(campaign, cls);

  return {
    id: generateId(),
    characterType: "pc",
    identity: makeIdentity(name),
    campaignId: campaign.id,
    raceId: race?.id,
    classId: cls.id,
    level: 1,
    proficiencyBonus: 2,
    attributes,
    attributeGeneration: makeAttributeGeneration(campaign),
    hp: makeHp(cls, attributes.CON),
    sheet: makeSheetDefaults(),
    skills: makeSkills(campaign),
    powers,
    inventory,
    attacks: syncDerivedAttacks(
      {
        powers,
        inventory,
        attacks: baseAttacks,
      },
      campaign
    ),
    levelProgression: makeLevelProgressionDefaults(1, cls),
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