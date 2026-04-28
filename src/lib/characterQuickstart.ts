import type {
  CharacterAttack,
  CharacterAttributeGeneration,
  CharacterHp,
  CharacterIdentity,
  CharacterItem,
  CharacterLevelProgressionState,
  CharacterPowerSelection,
  CharacterSkillSelection,
} from "../types/character";
import type {
  AttributeKey,
  CampaignDefinition,
  ClassDefinition,
  ClassItemChoiceRule,
  ClassPowerChoiceRule,
  ClassSkillChoiceRule,
  RaceDefinition,
} from "../types/gameData";
import { createCharacterFromCampaignAndClass, getAttributeModifier } from "./character";
import { syncDerivedAttacks } from "./attackSync";
import { getPointBuyCost } from "./pointBuy";

const ATTRS: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

type RandomFn = () => number;

export interface QuickstartCharacterDraft {
  identity: CharacterIdentity;
  campaignId: string;
  raceId: string;
  classId: string;
  level: number;
  proficiencyBonus: number;
  attributes: Record<AttributeKey, number>;
  saveProf: Record<AttributeKey, boolean>;
  attributeGeneration?: CharacterAttributeGeneration;
  hp: CharacterHp;
  skills: CharacterSkillSelection[];
  powers: CharacterPowerSelection[];
  inventory: CharacterItem[];
  attacks: CharacterAttack[];
  levelProgression: CharacterLevelProgressionState;
}

export interface QuickstartLocks {
  raceId?: string;
  classId?: string;
  background?: string;
  ancestry?: string;
  name?: string;
}

export interface QuickstartResult {
  draft: QuickstartCharacterDraft | null;
  warnings: string[];
  resolved: {
    raceId: string;
    classId: string;
  };
}

export interface QuickstartConcept {
  id: string;
  name: string;
  raceId: string;
  raceName: string;
  classId: string;
  className: string;
  background: string;
  attributeFocus: AttributeKey[];
  summary: string;
  draft: QuickstartCharacterDraft;
}

interface PointBuyTemplate {
  id: string;
  baseScores: [number, number, number, number, number, number];
}

const BALANCED_BASE_SCORES: [number, number, number, number, number, number] = [13, 13, 13, 12, 12, 12];

// These templates intentionally trade perfect optimization for broadly playable arrays.
const POINT_BUY_TEMPLATES: PointBuyTemplate[] = [
  { id: "specialist-a", baseScores: [15, 14, 13, 12, 10, 8] },
  { id: "specialist-b", baseScores: [15, 13, 13, 12, 12, 8] },
  { id: "balanced-a", baseScores: [14, 14, 13, 12, 10, 9] },
  { id: "balanced-b", baseScores: [14, 13, 13, 12, 12, 10] },
  { id: "utility", baseScores: [13, 13, 13, 12, 12, 12] },
];

// Attribute aliases let us recognize campaigns that use expanded names
// (for example "Strength" / "Agility" / "Vitality") while still mapping
// back to the engine's canonical attribute keys.
const ATTRIBUTE_ALIASES: Record<AttributeKey, string[]> = {
  STR: ["str", "strength", "might", "brawn", "power"],
  DEX: ["dex", "dexterity", "agility", "finesse", "quickness"],
  CON: ["con", "constitution", "vitality", "endurance", "stamina", "toughness"],
  INT: ["int", "intelligence", "intellect", "knowledge", "scholarship", "logic"],
  WIS: ["wis", "wisdom", "insight", "awareness", "spirit", "will"],
  CHA: ["cha", "charisma", "presence", "charm", "influence", "social"],
};

interface ClassProfile {
  profile: "fighter" | "rogue" | "wizard" | "cleric" | "bard" | "generic";
  // Some archetypes intentionally support two primaries (for example STR/DEX fighters).
  primaryOptions: AttributeKey[];
  secondary: AttributeKey[];
}

// Transparent, easy-to-edit profile table by class id.
const CLASS_PROFILE_OVERRIDES: Record<string, ClassProfile> = {
  fighter: { profile: "fighter", primaryOptions: ["STR", "DEX"], secondary: ["CON", "WIS"] },
  warrior: { profile: "fighter", primaryOptions: ["STR", "DEX"], secondary: ["CON", "WIS"] },
  soldier: { profile: "fighter", primaryOptions: ["STR", "DEX"], secondary: ["CON", "WIS"] },
  rogue: { profile: "rogue", primaryOptions: ["DEX"], secondary: ["WIS", "CHA", "CON"] },
  scout: { profile: "rogue", primaryOptions: ["DEX"], secondary: ["WIS", "CON", "INT"] },
  wizard: { profile: "wizard", primaryOptions: ["INT"], secondary: ["CON", "DEX", "WIS"] },
  scholar: { profile: "wizard", primaryOptions: ["INT"], secondary: ["WIS", "CON", "DEX"] },
  engineer: { profile: "wizard", primaryOptions: ["INT"], secondary: ["DEX", "CON", "WIS"] },
  cleric: { profile: "cleric", primaryOptions: ["WIS"], secondary: ["CON", "CHA", "STR"] },
  priest: { profile: "cleric", primaryOptions: ["WIS"], secondary: ["CHA", "CON", "INT"] },
  bard: { profile: "bard", primaryOptions: ["CHA"], secondary: ["DEX", "CON", "WIS"] },
  face: { profile: "bard", primaryOptions: ["CHA"], secondary: ["DEX", "WIS", "CON"] },
};

const DEFAULT_ATTRIBUTE_PRIORITY: AttributeKey[] = ["CON", "DEX", "WIS", "INT", "STR", "CHA"];

const BACKGROUND_TABLE: Record<string, string[]> = {
  fantasy: ["Wanderer", "Squire", "Street Urchin", "Temple Acolyte", "Arcane Apprentice"],
  scifi: ["Colony Survivor", "Shiphand", "Corporate Defector", "Frontier Scout", "Lab Tech"],
  default: ["Adventurer", "Survivor", "Scholar", "Mercenary", "Wanderer"],
};

const NAME_PREFIXES = ["Ar", "Bel", "Cor", "Da", "El", "Fen", "Gra", "Ira", "Ka", "Lor", "Mor", "Ny", "Or", "Pyr", "Quin", "Rin", "Sar", "Tor", "Val", "Zer"];
const NAME_SUFFIXES = ["adin", "ael", "bor", "cor", "dell", "en", "ion", "is", "or", "ra", "ric", "rin", "ros", "tar", "thos", "us", "wyn", "ya", "zor"];

function templateCost(baseScores: readonly number[]) {
  return baseScores.reduce((total, score) => total + getPointBuyCost(score), 0);
}

function randomIndex(length: number, rng: RandomFn) {
  if (length <= 0) return 0;
  return Math.floor(rng() * length) % length;
}

function chooseOne<T>(items: readonly T[], rng: RandomFn): T | null {
  if (items.length === 0) return null;
  return items[randomIndex(items.length, rng)] ?? null;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

function attributeFromText(text: string): AttributeKey | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  for (const key of ATTRS) {
    const aliases = ATTRIBUTE_ALIASES[key];
    if (aliases.includes(normalized)) {
      return key;
    }
  }

  return null;
}

function getCampaignAttributePool(campaign: CampaignDefinition): AttributeKey[] {
  const set = new Set<AttributeKey>();

  for (const cls of campaign.classes ?? []) {
    for (const bonus of cls.attributeBonuses ?? []) {
      set.add(bonus.attribute);
    }
  }

  for (const race of campaign.races ?? []) {
    for (const bonus of race.attributeBonuses ?? []) {
      set.add(bonus.attribute);
    }
  }

  for (const skill of campaign.skills ?? []) {
    set.add(skill.attribute);
  }

  // Campaign label text can hint at custom naming conventions.
  const labelText = campaign.labels?.attributes ?? "";
  const tokens = labelText
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  for (const token of tokens) {
    const attr = attributeFromText(token);
    if (attr) {
      set.add(attr);
    }
  }

  return set.size > 0 ? ATTRS.filter((attr) => set.has(attr)) : [...ATTRS];
}

function allowedRaces(campaign: CampaignDefinition) {
  const races = campaign.races ?? [];
  const availableRaceIds = campaign.availableRaceIds;
  if (!availableRaceIds || availableRaceIds.length === 0) {
    return races;
  }

  const allowed = new Set(availableRaceIds);
  const filtered = races.filter((race) => allowed.has(race.id));
  return filtered.length > 0 ? filtered : races;
}

function allowedClasses(campaign: CampaignDefinition) {
  const classes = campaign.classes ?? [];
  const availableClassIds = campaign.availableClassIds;
  if (!availableClassIds || availableClassIds.length === 0) {
    return classes;
  }

  const allowed = new Set(availableClassIds);
  const filtered = classes.filter((cls) => allowed.has(cls.id));
  return filtered.length > 0 ? filtered : classes;
}

function classesForRace(
  race: RaceDefinition | null,
  classPool: ClassDefinition[]
) {
  if (!race) return classPool;
  const raceAllowed = race.availableClassIds ?? [];
  if (raceAllowed.length === 0) return classPool;
  const raceAllowedSet = new Set(raceAllowed);
  return classPool.filter((cls) => raceAllowedSet.has(cls.id));
}

function resolveRace(
  campaign: CampaignDefinition,
  locks: QuickstartLocks,
  rng: RandomFn,
  warnings: string[]
) {
  const races = allowedRaces(campaign);
  if (races.length === 0) {
    warnings.push("Campaign has no available races; using an empty race selection.");
    return null;
  }

  if (locks.raceId) {
    const lockedRace = races.find((race) => race.id === locks.raceId);
    if (lockedRace) return lockedRace;
    warnings.push(`Locked race '${locks.raceId}' is unavailable in this campaign; selecting a valid race.`);
  }

  return chooseOne(races, rng);
}

function resolveClass(
  campaign: CampaignDefinition,
  race: RaceDefinition | null,
  locks: QuickstartLocks,
  rng: RandomFn,
  warnings: string[]
) {
  const classes = allowedClasses(campaign);
  if (classes.length === 0) {
    warnings.push("Campaign has no available classes.");
    return null;
  }

  const classesForChosenRace = classesForRace(race, classes);
  const candidateClasses = classesForChosenRace.length > 0 ? classesForChosenRace : classes;

  if (locks.classId) {
    const lockedClass = candidateClasses.find((cls) => cls.id === locks.classId);
    if (lockedClass) return lockedClass;
    warnings.push(`Locked class '${locks.classId}' is unavailable for the selected race/campaign; selecting a valid class.`);
  }

  return chooseOne(candidateClasses, rng);
}

function classPriorityFromRules(
  cls: ClassDefinition,
  campaign: CampaignDefinition,
  race: RaceDefinition | null
): AttributeKey[] {
  const classId = cls.id.trim().toLowerCase();
  const className = cls.name.trim().toLowerCase();
  const classTokens = new Set(className.split(/[^a-z0-9]+/).filter(Boolean));

  const findProfileFromText = (): ClassProfile => {
    const direct = CLASS_PROFILE_OVERRIDES[classId];
    if (direct) return direct;

    for (const [key, profile] of Object.entries(CLASS_PROFILE_OVERRIDES)) {
      if (classTokens.has(key)) return profile;
    }

    return { profile: "generic", primaryOptions: ["DEX", "WIS", "INT"], secondary: ["CON", "CHA", "STR"] };
  };

  const profile = findProfileFromText();
  const availableAttrs = new Set(getCampaignAttributePool(campaign));
  const raceBonusByAttr = new Map<AttributeKey, number>(ATTRS.map((attr) => [attr, 0]));
  for (const bonus of race?.attributeBonuses ?? []) {
    raceBonusByAttr.set(bonus.attribute, (raceBonusByAttr.get(bonus.attribute) ?? 0) + bonus.amount);
  }

  // Fighter/warrior archetypes can be STR or DEX based; species bonuses bias that choice.
  const primaryByRace = [...profile.primaryOptions]
    .filter((attr) => availableAttrs.has(attr))
    .sort((a, b) => (raceBonusByAttr.get(b) ?? 0) - (raceBonusByAttr.get(a) ?? 0));
  const selectedPrimary = primaryByRace[0] ?? profile.primaryOptions[0] ?? "CON";

  const weighted = new Map<AttributeKey, number>();
  for (const attr of ATTRS) {
    weighted.set(attr, 0);
  }

  weighted.set(selectedPrimary, (weighted.get(selectedPrimary) ?? 0) + 100);
  for (const [index, attr] of profile.secondary.entries()) {
    weighted.set(attr, (weighted.get(attr) ?? 0) + Math.max(10, 50 - index * 10));
  }

  // Durable characters are more playable; keep durability relevant in all profiles.
  weighted.set("CON", (weighted.get("CON") ?? 0) + 25);

  for (const bonus of cls.attributeBonuses ?? []) {
    weighted.set(bonus.attribute, (weighted.get(bonus.attribute) ?? 0) + Math.max(1, bonus.amount * 3));
  }

  for (const bonus of race?.attributeBonuses ?? []) {
    weighted.set(bonus.attribute, (weighted.get(bonus.attribute) ?? 0) + Math.max(0, bonus.amount * 2));
  }

  // Skill-rule attributes are another light signal for likely class focus.
  const skillById = new Map((campaign.skills ?? []).map((skill) => [skill.id, skill.attribute] as const));
  for (const rule of cls.skillChoiceRules ?? []) {
    const boost = Math.max(1, rule.choose);
    for (const id of rule.skillIds) {
      const attr = skillById.get(id);
      if (!attr) continue;
      weighted.set(attr, (weighted.get(attr) ?? 0) + boost);
    }
  }

  const ordered = [...ATTRS]
    .filter((attr) => availableAttrs.has(attr) || attr === "CON")
    .sort((a, b) => (weighted.get(b) ?? 0) - (weighted.get(a) ?? 0));
  const tieBroken = ordered.sort((a, b) => {
    const scoreDiff = (weighted.get(b) ?? 0) - (weighted.get(a) ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return DEFAULT_ATTRIBUTE_PRIORITY.indexOf(a) - DEFAULT_ATTRIBUTE_PRIORITY.indexOf(b);
  });

  // Ensure all canonical attributes still appear in deterministic order.
  for (const attr of ATTRS) {
    if (!tieBroken.includes(attr)) {
      tieBroken.push(attr);
    }
  }

  return tieBroken;
}

function applyBonuses(
  base: Record<AttributeKey, number>,
  cls: ClassDefinition | null,
  race: RaceDefinition | null
) {
  const next = { ...base };
  for (const bonus of cls?.attributeBonuses ?? []) {
    next[bonus.attribute] = (next[bonus.attribute] ?? 0) + bonus.amount;
  }
  for (const bonus of race?.attributeBonuses ?? []) {
    next[bonus.attribute] = (next[bonus.attribute] ?? 0) + bonus.amount;
  }
  return next;
}

function choosePointBuyTemplate(
  pointBuyTotal: number,
  rng: RandomFn
): PointBuyTemplate | null {
  const affordable = POINT_BUY_TEMPLATES
    .map((template) => ({ template, cost: templateCost(template.baseScores) }))
    .filter(({ cost }) => cost <= pointBuyTotal);

  if (affordable.length === 0) {
    return null;
  }

  const maxSpend = Math.max(...affordable.map(({ cost }) => cost));
  const nearMax = affordable.filter(({ cost }) => cost >= maxSpend - 1).map(({ template }) => template);
  return chooseOne(nearMax, rng) ?? nearMax[0] ?? null;
}

function assignScoresByPriority(
  priority: AttributeKey[],
  sortedScores: number[]
) {
  const base: Record<AttributeKey, number> = {
    STR: 8,
    DEX: 8,
    CON: 8,
    INT: 8,
    WIS: 8,
    CHA: 8,
  };

  for (let i = 0; i < ATTRS.length; i += 1) {
    const attr = priority[i] ?? ATTRS[i];
    base[attr] = sortedScores[i] ?? 8;
  }

  return base;
}

function buildPointBuyAttributes(
  campaign: CampaignDefinition,
  cls: ClassDefinition | null,
  race: RaceDefinition | null,
  rng: RandomFn,
  warnings: string[]
) {
  const min = campaign.attributeRules.minimumScore ?? 3;
  const max = campaign.attributeRules.maximumScore ?? 18;
  const rawPointBuyTotal = campaign.attributeRules.pointBuyTotal;
  const pointBuyTotal = Number.isFinite(rawPointBuyTotal) ? Number(rawPointBuyTotal) : 27;
  const priority = cls
    ? classPriorityFromRules(cls, campaign, race)
    : [...DEFAULT_ATTRIBUTE_PRIORITY];

  const attributeSignals = getCampaignAttributePool(campaign);
  const hasWeakAttributeSignals = attributeSignals.length <= 2;

  let sortedScores: number[] = [...BALANCED_BASE_SCORES].sort((a, b) => b - a);
  let generationMethod: CharacterAttributeGeneration["method"] = "manual";

  const template = choosePointBuyTemplate(pointBuyTotal, rng);
  if (template && !hasWeakAttributeSignals && pointBuyTotal >= 20) {
    sortedScores = [...template.baseScores].sort((a, b) => b - a);
    generationMethod = "pointBuy";
  } else {
    if (!template || pointBuyTotal < 20) {
      warnings.push("Point-buy rules were incomplete or too restrictive; used a balanced default spread.");
    }
    if (hasWeakAttributeSignals) {
      warnings.push("Campaign attributes were unclear; used a balanced attribute spread.");
    }
  }

  // Keep a solid durability floor and avoid dumping primary attributes.
  const durabilityAttr: AttributeKey = "CON";
  const primaryAttr = priority[0] ?? "CON";
  const minDurabilityBase = 12;
  const minPrimaryBase = 14;

  const durabilityIndex = priority.indexOf(durabilityAttr);
  if (durabilityIndex >= 0 && sortedScores[durabilityIndex] < minDurabilityBase) {
    const donorIndex = sortedScores.findIndex((score) => score >= minDurabilityBase);
    if (donorIndex >= 0) {
      const temp = sortedScores[durabilityIndex];
      sortedScores[durabilityIndex] = sortedScores[donorIndex];
      sortedScores[donorIndex] = temp;
    }
  }

  const primaryIndex = priority.indexOf(primaryAttr);
  if (primaryIndex >= 0 && sortedScores[primaryIndex] < minPrimaryBase) {
    const donorIndex = sortedScores.findIndex((score) => score >= minPrimaryBase);
    if (donorIndex >= 0) {
      const temp = sortedScores[primaryIndex];
      sortedScores[primaryIndex] = sortedScores[donorIndex];
      sortedScores[donorIndex] = temp;
    }
  }

  const base = assignScoresByPriority(priority, sortedScores);

  const withBonuses = applyBonuses(base, cls, race);
  const clamped: Record<AttributeKey, number> = {
    STR: clamp(withBonuses.STR, min, max),
    DEX: clamp(withBonuses.DEX, min, max),
    CON: clamp(withBonuses.CON, min, max),
    INT: clamp(withBonuses.INT, min, max),
    WIS: clamp(withBonuses.WIS, min, max),
    CHA: clamp(withBonuses.CHA, min, max),
  };

  return {
    attributes: clamped,
    priority,
    pointBuyTotal,
    generationMethod,
  };
}

function pickUniqueIdsFromRule<T extends { id: string }>(
  ruleIds: string[],
  choose: number,
  byId: Map<string, T>,
  rng: RandomFn
) {
  const pool = uniqueById(ruleIds.map((id) => byId.get(id)).filter((v): v is T => Boolean(v)));
  const available = [...pool];
  const picks: T[] = [];
  const target = Math.max(0, Math.min(choose, available.length));

  while (picks.length < target && available.length > 0) {
    const idx = randomIndex(available.length, rng);
    const next = available.splice(idx, 1)[0];
    if (!next) continue;
    picks.push(next);
  }

  return picks;
}

function buildSaveProficiencies(priority: AttributeKey[]) {
  const preferred = [priority[0], priority[1]].filter((v): v is AttributeKey => Boolean(v));
  const saveProf: Record<AttributeKey, boolean> = {
    STR: false,
    DEX: false,
    CON: false,
    INT: false,
    WIS: false,
    CHA: false,
  };

  for (const attr of preferred) {
    saveProf[attr] = true;
  }

  // Ensure exactly two are selected even with malformed priority input.
  let count = preferred.length;
  for (const attr of DEFAULT_ATTRIBUTE_PRIORITY) {
    if (count >= 2) break;
    if (saveProf[attr]) continue;
    saveProf[attr] = true;
    count += 1;
  }

  return saveProf;
}

function applySkillChoices(
  skills: CharacterSkillSelection[],
  rules: ClassSkillChoiceRule[] | undefined,
  campaign: CampaignDefinition,
  rng: RandomFn
) {
  if (!rules || rules.length === 0) return skills;

  const validSkillIds = new Set((campaign.skills ?? []).map((skill) => skill.id));
  const selected = new Set<string>();

  for (const rule of rules) {
    const legalIds = (rule.skillIds ?? []).filter((id) => validSkillIds.has(id));
    const shuffled = [...legalIds];
    const picks: string[] = [];

    while (picks.length < Math.max(0, rule.choose) && shuffled.length > 0) {
      const idx = randomIndex(shuffled.length, rng);
      const id = shuffled.splice(idx, 1)[0];
      if (!id) continue;
      if (selected.has(id)) continue;
      selected.add(id);
      picks.push(id);
    }
  }

  return skills.map((skill) =>
    selected.has(skill.skillId)
      ? {
          ...skill,
          proficient: true,
          source: "wizard-choice" as const,
        }
      : skill
  );
}

function applyPowerChoices(
  existing: CharacterPowerSelection[],
  rules: ClassPowerChoiceRule[] | undefined,
  campaign: CampaignDefinition,
  rng: RandomFn
) {
  if (!rules || rules.length === 0) return existing;

  const byId = new Map((campaign.powers ?? []).map((power) => [power.id, power] as const));
  const already = new Set(existing.map((power) => power.powerId).filter((id): id is string => Boolean(id)));
  const picked: CharacterPowerSelection[] = [];

  for (const rule of rules) {
    const candidates = pickUniqueIdsFromRule(rule.powerIds ?? [], rule.choose, byId, rng).filter(
      (power) => !already.has(power.id)
    );

    for (const power of candidates) {
      already.add(power.id);
      picked.push({
        powerId: power.id,
        name: power.name,
        notes: power.description,
        source: "wizard-choice",
        usesPerDay: power.usesPerDay,
        description: power.description,
        saveAttribute: power.saveAttribute,
      });
    }
  }

  return [...existing, ...picked];
}

function applyItemChoices(
  rules: ClassItemChoiceRule[] | undefined,
  campaign: CampaignDefinition,
  rng: RandomFn
) {
  if (!rules || rules.length === 0) return [];

  const byId = new Map((campaign.items ?? []).map((item) => [item.id, item] as const));
  const picked: CharacterItem[] = [];
  const already = new Set<string>();

  for (const rule of rules) {
    const candidates = pickUniqueIdsFromRule(rule.itemIds ?? [], rule.choose, byId, rng).filter(
      (item) => !already.has(item.id)
    );

    for (const item of candidates) {
      already.add(item.id);
      picked.push({
        itemId: item.id,
        name: item.name,
        quantity: item.defaultQuantity ?? 1,
        notes: item.description,
        source: "wizard-choice",
      });
    }
  }

  return picked;
}

function generateName(rng: RandomFn) {
  const first = chooseOne(NAME_PREFIXES, rng) ?? "Ar";
  const second = chooseOne(NAME_SUFFIXES, rng) ?? "in";
  return `${first}${second}`;
}

function generateBackground(campaign: CampaignDefinition, rng: RandomFn) {
  const table = BACKGROUND_TABLE[campaign.id] ?? BACKGROUND_TABLE.default;
  return chooseOne(table, rng) ?? "Adventurer";
}

function makeSummary(
  race: RaceDefinition | null,
  cls: ClassDefinition | null,
  background: string,
  focus: AttributeKey[]
) {
  const focusText = focus.slice(0, 2).join("/");
  return `${race?.name ?? "No species"} ${cls?.name ?? "Adventurer"} with a ${background.toLowerCase()} background. Focus: ${focusText}.`;
}

function buildIdentity(campaign: CampaignDefinition, locks: QuickstartLocks, rng: RandomFn) {
  const background = locks.background?.trim() || generateBackground(campaign, rng);
  return {
    name: locks.name?.trim() || generateName(rng),
    playerName: "",
    notes: "",
    ancestry: locks.ancestry ?? "",
    background,
  };
}

function makeFallbackDraftWithoutClass(
  campaign: CampaignDefinition,
  race: RaceDefinition | null,
  locks: QuickstartLocks,
  rng: RandomFn,
  warnings: string[]
): QuickstartCharacterDraft {
  warnings.push("No classes are defined for this campaign; generated a basic concept without a class.");

  const identity = buildIdentity(campaign, locks, rng);
  const pointBuy = buildPointBuyAttributes(campaign, null, race, rng, warnings);
  const saveProf = buildSaveProficiencies(pointBuy.priority);
  const hpMax = Math.max(1, 8 + getAttributeModifier(pointBuy.attributes.CON));

  const skills: CharacterSkillSelection[] = (campaign.skills ?? []).map((skill) => ({
    skillId: skill.id,
    attribute: skill.attribute,
    proficient: false,
    bonus: 0,
    source: "campaign",
  }));

  // Pick up to two broadly useful proficiencies so fallback concepts are still playable.
  const skillPool = [...skills];
  const skillPickCount = Math.min(2, skillPool.length);
  for (let i = 0; i < skillPickCount; i += 1) {
    const idx = randomIndex(skillPool.length, rng);
    const pick = skillPool.splice(idx, 1)[0];
    if (!pick) continue;
    const target = skills.find((s) => s.skillId === pick.skillId);
    if (!target) continue;
    target.proficient = true;
    target.source = "wizard-choice";
  }

  const attacks = syncDerivedAttacks(
    {
      powers: [],
      inventory: [],
      attacks: [],
    },
    campaign
  );

  return {
    identity: {
      ...identity,
      ancestry: locks.ancestry ?? race?.name ?? identity.ancestry,
    },
    campaignId: campaign.id,
    raceId: race?.id ?? "",
    classId: "",
    level: 1,
    proficiencyBonus: 2,
    attributes: pointBuy.attributes,
    saveProf,
    attributeGeneration: {
      method: pointBuy.generationMethod,
      pointBuyTotal: pointBuy.pointBuyTotal,
      notes: "Generated by Character Quickstart fallback (no class data).",
    },
    hp: {
      max: hpMax,
      current: hpMax,
      temp: 0,
      hitDie: 8,
      notes: "Fallback HP applied due to missing class rules.",
    },
    skills,
    powers: [],
    inventory: [],
    attacks,
    levelProgression: {
      totalHitDice: 1,
      gainedSkillIds: [],
      gainedPowerIds: [],
      appliedLevels: [1],
      appliedAttributeIncreases: {
        STR: 0,
        DEX: 0,
        CON: 0,
        INT: 0,
        WIS: 0,
        CHA: 0,
      },
    },
  };
}

export function generateQuickstartDraft(
  campaign: CampaignDefinition,
  locks: QuickstartLocks = {},
  rng: RandomFn = Math.random
): QuickstartResult {
  const warnings: string[] = [];

  if (!campaign || !campaign.id) {
    return {
      draft: null,
      warnings: ["Missing campaign configuration."],
      resolved: {
        raceId: "",
        classId: "",
      },
    };
  }

  const race = resolveRace(campaign, locks, rng, warnings);
  const cls = resolveClass(campaign, race, locks, rng, warnings);

  if (!cls) {
    const fallback = makeFallbackDraftWithoutClass(campaign, race, locks, rng, warnings);
    return {
      draft: fallback,
      warnings,
      resolved: {
        raceId: fallback.raceId,
        classId: fallback.classId,
      },
    };
  }

  const identity = buildIdentity(campaign, locks, rng);
  const baseCharacter = createCharacterFromCampaignAndClass(campaign, cls, identity.name, race);
  const pointBuy = buildPointBuyAttributes(campaign, cls, race, rng, warnings);
  const saveProf = buildSaveProficiencies(pointBuy.priority);

  const skills = applySkillChoices(baseCharacter.skills, cls.skillChoiceRules, campaign, rng);
  const powers = applyPowerChoices(baseCharacter.powers, cls.powerChoiceRules, campaign, rng);
  const inventory = applyItemChoices(cls.itemChoiceRules, campaign, rng);

  const hpMax = Math.max(1, cls.hpRule.hitDie + getAttributeModifier(pointBuy.attributes.CON));

  const draft: QuickstartCharacterDraft = {
    identity: {
      ...identity,
      ancestry: locks.ancestry ?? race?.name ?? identity.ancestry,
    },
    campaignId: campaign.id,
    raceId: race?.id ?? "",
    classId: cls.id,
    level: baseCharacter.level,
    proficiencyBonus: baseCharacter.proficiencyBonus,
    attributes: pointBuy.attributes,
    saveProf,
    attributeGeneration: {
      method: pointBuy.generationMethod,
      pointBuyTotal: pointBuy.pointBuyTotal,
      notes: "Generated by Character Quickstart",
    },
    hp: {
      ...baseCharacter.hp,
      max: hpMax,
      current: hpMax,
      hitDie: cls.hpRule.hitDie,
    },
    skills,
    powers,
    inventory,
    attacks: syncDerivedAttacks(
      {
        powers,
        inventory,
        attacks: baseCharacter.attacks,
      },
      campaign
    ),
    levelProgression: baseCharacter.levelProgression,
  };

  return {
    draft,
    warnings,
    resolved: {
      raceId: draft.raceId,
      classId: draft.classId,
    },
  };
}

export function generateQuickstartConcepts(
  campaign: CampaignDefinition,
  locks: QuickstartLocks = {},
  count = 3,
  rng: RandomFn = Math.random
): QuickstartConcept[] {
  const availableRaces = allowedRaces(campaign);
  const availableClasses = allowedClasses(campaign);
  const lockedRace = locks.raceId
    ? availableRaces.find((race) => race.id === locks.raceId) ?? null
    : null;

  const racePool: Array<RaceDefinition | null> =
    lockedRace
      ? [lockedRace]
      : availableRaces.length > 0
      ? availableRaces
      : [null];

  const estimatedDistinctRaceClassCombos = racePool.reduce((total, race) => {
    if (availableClasses.length === 0) {
      return total + 1;
    }

    const compatible = classesForRace(race, availableClasses);
    return total + Math.max(1, compatible.length > 0 ? compatible.length : availableClasses.length);
  }, 0);

  const concepts: QuickstartConcept[] = [];
  const seenRaceClassCombos = new Set<string>();
  const seenFullCombos = new Set<string>();
  const target = Math.max(1, count);
  const distinctComboTarget = Math.max(1, Math.min(target, estimatedDistinctRaceClassCombos));
  let attempts = 0;
  const maxAttempts = target * 12;

  while (concepts.length < target && attempts < maxAttempts) {
    attempts += 1;
    const result = generateQuickstartDraft(campaign, locks, rng);
    const draft = result.draft;
    if (!draft) continue;

    const raceClassKey = `${draft.raceId}|${draft.classId}`;
    const fullComboKey = `${raceClassKey}|${draft.identity.background ?? ""}`;

    // In 3-concept mode, prioritize distinct race/class options first so the choices feel meaningfully different.
    if (
      seenRaceClassCombos.has(raceClassKey) &&
      seenRaceClassCombos.size < distinctComboTarget &&
      attempts < maxAttempts
    ) {
      continue;
    }

    if (seenFullCombos.has(fullComboKey) && attempts < maxAttempts) {
      continue;
    }

    seenRaceClassCombos.add(raceClassKey);
    seenFullCombos.add(fullComboKey);

    const race = (campaign.races ?? []).find((candidate) => candidate.id === draft.raceId) ?? null;
    const cls = (campaign.classes ?? []).find((candidate) => candidate.id === draft.classId) ?? null;
    const focus = cls
      ? classPriorityFromRules(cls, campaign, race)
      : [...DEFAULT_ATTRIBUTE_PRIORITY];
    const background = draft.identity.background ?? "Adventurer";

    concepts.push({
      id: `${draft.classId}-${draft.raceId || "norace"}-${concepts.length + 1}`,
      name: draft.identity.name,
      raceId: draft.raceId,
      raceName: race?.name ?? "Unknown",
      classId: draft.classId,
      className: cls?.name ?? "Adventurer",
      background,
      attributeFocus: focus.slice(0, 3),
      summary: makeSummary(race, cls, background, focus),
      draft,
    });
  }

  return concepts;
}
