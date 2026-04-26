import type {
  AttributeKey,
  AttackTemplateDefinition,
  CampaignDefinition,
  ClassDefinition,
  ClassItemChoiceRule,
  ClassLevelProgressionRow,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  GameData,
  HpRule,
  ItemDefinition,
  LevelProgressionHpGainMode,
  PowerDefinition,
  RaceDefinition,
  SkillDefinition,
} from "../types/gameData";
import type { CharacterRecord } from "../types/character";

type CampaignAssets = {
  classes: ClassDefinition[];
  races: RaceDefinition[];
  skills: SkillDefinition[];
  powers: PowerDefinition[];
  items: ItemDefinition[];
  attacks: AttackTemplateDefinition[];
};

const ATTRIBUTE_KEYS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

function makeDefaultLabels() {
  return {
    attributes: "Attributes",
    skills: "Skills",
    attacks: "Attacks",
    powers: "Powers",
    inventory: "Inventory",
    className: "Class",
    level: "Level",
    hp: "HP",
  };
}

function makeDefaultHpRule(rule: Partial<HpRule> | undefined): HpRule {
  return {
    hitDie: Number.isFinite(rule?.hitDie) ? Number(rule?.hitDie) : 8,
    level1Mode: rule?.level1Mode ?? "fixed-max",
    level1FixedValue: Number.isFinite(rule?.level1FixedValue)
      ? Number(rule?.level1FixedValue)
      : undefined,
    levelUpMode: rule?.levelUpMode ?? "fixed-average",
    levelUpFixedValue: Number.isFinite(rule?.levelUpFixedValue)
      ? Number(rule?.levelUpFixedValue)
      : undefined,
  };
}

function normalizeSkillRules(
  rules: ClassSkillChoiceRule[] | undefined,
  allowedSkillIds: Set<string>
) {
  return (rules ?? [])
    .map((rule) => ({
      choose: Number.isFinite(rule.choose) ? Math.max(0, Math.floor(rule.choose)) : 0,
      skillIds: (rule.skillIds ?? []).filter((id) => allowedSkillIds.has(id)),
    }))
    .filter((rule) => rule.choose > 0 || rule.skillIds.length > 0);
}

function normalizePowerRules(
  rules: ClassPowerChoiceRule[] | undefined,
  allowedPowerIds: Set<string>
) {
  return (rules ?? [])
    .map((rule) => ({
      choose: Number.isFinite(rule.choose) ? Math.max(0, Math.floor(rule.choose)) : 0,
      powerIds: (rule.powerIds ?? []).filter((id) => allowedPowerIds.has(id)),
    }))
    .filter((rule) => rule.choose > 0 || rule.powerIds.length > 0);
}

function normalizeItemRules(
  rules: ClassItemChoiceRule[] | undefined,
  allowedItemIds: Set<string>
) {
  return (rules ?? [])
    .map((rule) => ({
      choose: Number.isFinite(rule.choose) ? Math.max(0, Math.floor(rule.choose)) : 0,
      itemIds: (rule.itemIds ?? []).filter((id) => allowedItemIds.has(id)),
    }))
    .filter((rule) => rule.choose > 0 || rule.itemIds.length > 0);
}

function normalizePowerDefinition(power: PowerDefinition): PowerDefinition {
  return {
    ...power,
    level: Number.isFinite(power.level) ? Math.max(1, Math.floor(Number(power.level))) : 1,
    isAttack: Boolean(power.isAttack),
  };
}

function normalizeProgressionRows(
  rows: ClassLevelProgressionRow[] | undefined,
  fallbackAttributeBonuses: Array<{ attribute: AttributeKey; amount: number }>
) {
  const rawRows = rows && rows.length > 0
    ? rows
    : [{
        level: 2,
        hitDiceGained: 1,
        hpGainMode: "half" as LevelProgressionHpGainMode,
        newSkillChoices: 0,
        newPowerChoices: 0,
        attributeBonuses: fallbackAttributeBonuses,
      }];

  const normalized = rawRows
    .map((row) => ({
      level: Number.isFinite(row.level) ? Math.max(1, Math.floor(row.level)) : 1,
      hitDiceGained: Number.isFinite(row.hitDiceGained)
        ? Math.max(0, Math.floor(row.hitDiceGained))
        : 0,
      hpGainMode:
        row.hpGainMode === "full" || row.hpGainMode === "random" || row.hpGainMode === "half"
          ? row.hpGainMode
          : "half",
      proficiencyBonus: Number.isFinite(row.proficiencyBonus)
        ? Math.max(0, Math.floor(Number(row.proficiencyBonus)))
        : undefined,
      newSkillChoices: Number.isFinite(row.newSkillChoices)
        ? Math.max(0, Math.floor(row.newSkillChoices))
        : 0,
      newPowerChoices: Number.isFinite(row.newPowerChoices)
        ? Math.max(0, Math.floor(row.newPowerChoices))
        : 0,
      attributeBonuses: (row.attributeBonuses ?? [])
        .filter((bonus) => ATTRIBUTE_KEYS.includes(bonus.attribute))
        .map((bonus) => ({
          attribute: bonus.attribute,
          amount: Number.isFinite(bonus.amount) ? Number(bonus.amount) : 0,
        })),
    }))
    .sort((a, b) => a.level - b.level);

  const dedupedByLevel = new Map<number, (typeof normalized)[number]>();
  for (const row of normalized) {
    dedupedByLevel.set(row.level, row);
  }

  return [...dedupedByLevel.values()].sort((a, b) => a.level - b.level);
}

function normalizeClassForCampaign(
  campaignId: string,
  cls: ClassDefinition,
  campaignAssets: Omit<CampaignAssets, "classes">
) {
  const skillIds = new Set(campaignAssets.skills.map((skill) => skill.id));
  const powerIds = new Set(campaignAssets.powers.map((power) => power.id));
  const itemIds = new Set(campaignAssets.items.map((item) => item.id));
  const attackIds = new Set(campaignAssets.attacks.map((attack) => attack.id));

  const attributeBonuses = (cls.attributeBonuses ?? [])
    .filter((bonus) => ATTRIBUTE_KEYS.includes(bonus.attribute))
    .map((bonus) => ({
      attribute: bonus.attribute,
      amount: Number.isFinite(bonus.amount) ? Number(bonus.amount) : 0,
    }));

  const skillChoiceRules = normalizeSkillRules(cls.skillChoiceRules, skillIds);
  const powerChoiceRules = normalizePowerRules(cls.powerChoiceRules, powerIds);
  const itemChoiceRules = normalizeItemRules(cls.itemChoiceRules, itemIds);

  return {
    ...cls,
    campaignId,
    attributeBonuses,
    hpRule: makeDefaultHpRule(cls.hpRule),
    levelProgression: normalizeProgressionRows(cls.levelProgression, attributeBonuses),
    startingAttackTemplateIds: (cls.startingAttackTemplateIds ?? []).filter((id) => attackIds.has(id)),
    defaultPowerIds: (cls.defaultPowerIds ?? []).filter((id) => powerIds.has(id)),
    defaultItemIds: (cls.defaultItemIds ?? []).filter((id) => itemIds.has(id)),
    skillChoiceRules,
    powerChoiceRules,
    itemChoiceRules,
    levelUpSkillChoiceRules: normalizeSkillRules(cls.levelUpSkillChoiceRules, skillIds),
    levelUpPowerChoiceRules: normalizePowerRules(cls.levelUpPowerChoiceRules, powerIds),
    levelUpItemChoiceRules: normalizeItemRules(cls.levelUpItemChoiceRules, itemIds),
  };
}

function normalizeRaceForCampaign(
  campaignId: string,
  race: RaceDefinition,
  classIds: Set<string>,
  powerIds: Set<string>
) {
  return {
    ...race,
    campaignId,
    attributeBonuses: (race.attributeBonuses ?? [])
      .filter((bonus) => ATTRIBUTE_KEYS.includes(bonus.attribute))
      .map((bonus) => ({
        attribute: bonus.attribute,
        amount: Number.isFinite(bonus.amount) ? Number(bonus.amount) : 0,
      })),
    defaultPowerIds: (race.defaultPowerIds ?? []).filter((id) => powerIds.has(id)),
    availableClassIds: (race.availableClassIds ?? []).filter((id) => classIds.has(id)),
  };
}

export function normalizeCampaignDefinition(campaign: CampaignDefinition): CampaignDefinition {
  const baseAssets = {
    races: campaign.races ?? [],
    skills: campaign.skills ?? [],
    powers: (campaign.powers ?? []).map((power) => normalizePowerDefinition(power)),
    items: (campaign.items ?? []).map((item) => ({
      ...item,
      isAttack: Boolean(item.isAttack),
    })),
    attacks: campaign.attackTemplates ?? [],
  };

  const classes = (campaign.classes ?? []).map((cls) =>
    normalizeClassForCampaign(campaign.id, cls, baseAssets)
  );
  const classIds = new Set(classes.map((cls) => cls.id));
  const powerIds = new Set(baseAssets.powers.map((power) => power.id));
  const races = baseAssets.races.map((race) =>
    normalizeRaceForCampaign(campaign.id, race, classIds, powerIds)
  );

  return {
    ...campaign,
    name: campaign.name ?? campaign.id,
    labels: {
      ...makeDefaultLabels(),
      ...(campaign.labels ?? {}),
    },
    attributeRules: {
      generationMethods:
        campaign.attributeRules?.generationMethods &&
        campaign.attributeRules.generationMethods.length > 0
          ? campaign.attributeRules.generationMethods
          : ["pointBuy", "randomRoll", "manual"],
      pointBuyTotal: Number.isFinite(campaign.attributeRules?.pointBuyTotal)
        ? Number(campaign.attributeRules?.pointBuyTotal)
        : 27,
      randomRollFormula: campaign.attributeRules?.randomRollFormula ?? "4d6 drop lowest",
      randomRollCount: Number.isFinite(campaign.attributeRules?.randomRollCount)
        ? Number(campaign.attributeRules?.randomRollCount)
        : 6,
      randomRollDropLowest: Number.isFinite(campaign.attributeRules?.randomRollDropLowest)
        ? Number(campaign.attributeRules?.randomRollDropLowest)
        : 1,
      minimumScore: Number.isFinite(campaign.attributeRules?.minimumScore)
        ? Number(campaign.attributeRules?.minimumScore)
        : 3,
      maximumScore: Number.isFinite(campaign.attributeRules?.maximumScore)
        ? Number(campaign.attributeRules?.maximumScore)
        : 18,
    },
    classes,
    races,
    skills: baseAssets.skills,
    powers: baseAssets.powers,
    items: baseAssets.items,
    attackTemplates: baseAssets.attacks,
    availableClassIds: (campaign.availableClassIds ?? classes.map((cls) => cls.id)).filter((id) =>
      classes.some((cls) => cls.id === id)
    ),
    availableRaceIds: (campaign.availableRaceIds ?? races.map((race) => race.id)).filter((id) =>
      races.some((race) => race.id === id)
    ),
    availableSkillIds: (campaign.availableSkillIds ?? baseAssets.skills.map((skill) => skill.id)).filter((id) =>
      baseAssets.skills.some((skill) => skill.id === id)
    ),
    availablePowerIds: (campaign.availablePowerIds ?? baseAssets.powers.map((power) => power.id)).filter((id) =>
      baseAssets.powers.some((power) => power.id === id)
    ),
    availableItemIds: (campaign.availableItemIds ?? baseAssets.items.map((item) => item.id)).filter((id) =>
      baseAssets.items.some((item) => item.id === id)
    ),
    availableAttackTemplateIds:
      (campaign.availableAttackTemplateIds ?? baseAssets.attacks.map((attack) => attack.id)).filter((id) =>
        baseAssets.attacks.some((attack) => attack.id === id)
      ),
  };
}

export function validateClassRulesAgainstCampaign(
  cls: ClassDefinition,
  campaign: CampaignDefinition | null | undefined
) {
  const assets = resolveCampaignAssets(campaign);
  const skillIds = new Set(assets.skills.map((skill) => skill.id));
  const powerIds = new Set(assets.powers.map((power) => power.id));
  const itemIds = new Set(assets.items.map((item) => item.id));
  const attackIds = new Set(assets.attacks.map((attack) => attack.id));

  const invalidSkillRuleIds = (cls.skillChoiceRules ?? [])
    .flatMap((rule) => rule.skillIds ?? [])
    .filter((id) => !skillIds.has(id));
  const invalidPowerRuleIds = (cls.powerChoiceRules ?? [])
    .flatMap((rule) => rule.powerIds ?? [])
    .filter((id) => !powerIds.has(id));
  const invalidItemRuleIds = (cls.itemChoiceRules ?? [])
    .flatMap((rule) => rule.itemIds ?? [])
    .filter((id) => !itemIds.has(id));
  const invalidAttackTemplateIds = (cls.startingAttackTemplateIds ?? []).filter(
    (id) => !attackIds.has(id)
  );

  return {
    invalidSkillRuleIds: Array.from(new Set(invalidSkillRuleIds)),
    invalidPowerRuleIds: Array.from(new Set(invalidPowerRuleIds)),
    invalidItemRuleIds: Array.from(new Set(invalidItemRuleIds)),
    invalidAttackTemplateIds: Array.from(new Set(invalidAttackTemplateIds)),
  };
}

export function validateProgressionRows(rows: ClassLevelProgressionRow[] | undefined) {
  const invalidAttributeBonuses = (rows ?? [])
    .flatMap((row) => row.attributeBonuses ?? [])
    .filter((bonus) => !ATTRIBUTE_KEYS.includes(bonus.attribute));

  const invalidLevels = (rows ?? []).filter(
    (row) => !Number.isFinite(row.level) || Math.floor(row.level) < 1
  );

  return {
    invalidAttributeBonuses,
    invalidLevels,
  };
}

export function applySafeCampaignDefaults(
  campaign: CampaignDefinition | null | undefined
): CampaignAssets {
  if (!campaign) {
    return {
      classes: [],
      races: [],
      skills: [],
      powers: [],
      items: [],
      attacks: [],
    };
  }

  return {
    classes: campaign.classes ?? [],
    races: campaign.races ?? [],
    skills: campaign.skills ?? [],
    powers: campaign.powers ?? [],
    items: campaign.items ?? [],
    attacks: campaign.attackTemplates ?? [],
  };
}

export function findCampaign(gameData: GameData, campaignId: string) {
  return gameData.campaigns.find((campaign) => campaign.id === campaignId);
}

export function findClassInCampaign(
  campaign: CampaignDefinition | null | undefined,
  classId: string
) {
  if (!campaign) return undefined;
  return (campaign.classes ?? []).find((cls) => cls.id === classId);
}

export function findRaceInCampaign(
  campaign: CampaignDefinition | null | undefined,
  raceId: string
) {
  if (!campaign) return undefined;
  return (campaign.races ?? []).find((race) => race.id === raceId);
}

export function resolveCampaignAssets(campaign: CampaignDefinition | null | undefined) {
  return applySafeCampaignDefaults(campaign);
}

export function validateClassReference(
  campaign: CampaignDefinition | null | undefined,
  classId: string
) {
  const cls = findClassInCampaign(campaign, classId);
  return {
    isValid: Boolean(cls),
    classDef: cls,
  };
}

export function validateCharacterReferences(
  character: CharacterRecord,
  campaign: CampaignDefinition | null | undefined
) {
  const safeCharacter = applySafeCharacterDefaults(character);
  const assets = resolveCampaignAssets(campaign);
  const classValid = assets.classes.some((cls) => cls.id === safeCharacter.classId);
  const raceValid = !safeCharacter.raceId || assets.races.some((race) => race.id === safeCharacter.raceId);
  const skillIdSet = new Set(assets.skills.map((skill) => skill.id));
  const powerIdSet = new Set(assets.powers.map((power) => power.id));
  const itemIdSet = new Set(assets.items.map((item) => item.id));
  const attackIdSet = new Set(assets.attacks.map((attack) => attack.id));

  return {
    classValid,
    raceValid,
    invalidSkillIds: safeCharacter.skills
      .map((skill) => skill.skillId)
      .filter((skillId) => !skillIdSet.has(skillId)),
    invalidPowerIds: safeCharacter.powers
      .map((power) => power.powerId)
      .filter(
        (powerId): powerId is string => typeof powerId === "string" && !powerIdSet.has(powerId)
      ),
    invalidItemIds: safeCharacter.inventory
      .map((item) => item.itemId)
      .filter(
        (itemId): itemId is string => typeof itemId === "string" && !itemIdSet.has(itemId)
      ),
    invalidAttackTemplateIds: safeCharacter.attacks
      .map((attack) => attack.templateId)
      .filter(
        (templateId): templateId is string =>
          typeof templateId === "string" && !attackIdSet.has(templateId)
      ),
  };
}

export function applySafeCharacterDefaults(character: CharacterRecord): CharacterRecord {
  const level = Number.isFinite(character.level) ? Math.max(1, Math.floor(character.level)) : 1;
  const normalizedSpeed = `${character.sheet?.speed ?? ""}`.trim() || "30";

  return {
    ...character,
    characterType: character.characterType === "npc" ? "npc" : "pc",
    level,
    hp: {
      max: Number.isFinite(character.hp?.max) ? Number(character.hp.max) : 0,
      current: Number.isFinite(character.hp?.current) ? Number(character.hp.current) : 0,
      temp: Number.isFinite(character.hp?.temp) ? Number(character.hp.temp) : 0,
      hitDie: Number.isFinite(character.hp?.hitDie) ? Number(character.hp.hitDie) : undefined,
      notes: character.hp?.notes ?? "",
    },
    sheet: {
      speed: normalizedSpeed,
      acBase: Number.isFinite(character.sheet?.acBase) ? Number(character.sheet.acBase) : 10,
      acBonus: Number.isFinite(character.sheet?.acBonus) ? Number(character.sheet.acBonus) : 0,
      acUseDex: typeof character.sheet?.acUseDex === "boolean" ? character.sheet.acUseDex : true,
      initMisc: Number.isFinite(character.sheet?.initMisc) ? Number(character.sheet.initMisc) : 0,
      saveProf: {
        STR: Boolean(character.sheet?.saveProf?.STR),
        DEX: Boolean(character.sheet?.saveProf?.DEX),
        CON: Boolean(character.sheet?.saveProf?.CON),
        INT: Boolean(character.sheet?.saveProf?.INT),
        WIS: Boolean(character.sheet?.saveProf?.WIS),
        CHA: Boolean(character.sheet?.saveProf?.CHA),
      },
      saveBonus: {
        STR: Number(character.sheet?.saveBonus?.STR ?? 0),
        DEX: Number(character.sheet?.saveBonus?.DEX ?? 0),
        CON: Number(character.sheet?.saveBonus?.CON ?? 0),
        INT: Number(character.sheet?.saveBonus?.INT ?? 0),
        WIS: Number(character.sheet?.saveBonus?.WIS ?? 0),
        CHA: Number(character.sheet?.saveBonus?.CHA ?? 0),
      },
    },
    skills: Array.isArray(character.skills) ? character.skills : [],
    powers: Array.isArray(character.powers) ? character.powers : [],
    inventory: Array.isArray(character.inventory) ? character.inventory : [],
    attacks: Array.isArray(character.attacks) ? character.attacks : [],
    levelProgression: {
      totalHitDice: Number.isFinite(character.levelProgression?.totalHitDice)
        ? Math.max(0, Math.floor(character.levelProgression.totalHitDice))
        : level,
      gainedSkillIds: Array.isArray(character.levelProgression?.gainedSkillIds)
        ? character.levelProgression.gainedSkillIds.filter((value): value is string => typeof value === "string")
        : [],
      gainedPowerIds: Array.isArray(character.levelProgression?.gainedPowerIds)
        ? character.levelProgression.gainedPowerIds.filter((value): value is string => typeof value === "string")
        : [],
      appliedLevels: Array.isArray(character.levelProgression?.appliedLevels)
        ? character.levelProgression.appliedLevels
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .map((value) => Math.max(1, Math.floor(value)))
        : Array.from({ length: level }, (_value, index) => index + 1),
      appliedAttributeIncreases: {
        STR: Number(character.levelProgression?.appliedAttributeIncreases?.STR ?? 0),
        DEX: Number(character.levelProgression?.appliedAttributeIncreases?.DEX ?? 0),
        CON: Number(character.levelProgression?.appliedAttributeIncreases?.CON ?? 0),
        INT: Number(character.levelProgression?.appliedAttributeIncreases?.INT ?? 0),
        WIS: Number(character.levelProgression?.appliedAttributeIncreases?.WIS ?? 0),
        CHA: Number(character.levelProgression?.appliedAttributeIncreases?.CHA ?? 0),
      },
    },
  };
}