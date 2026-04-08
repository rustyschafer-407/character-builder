import type { CharacterRecord } from "../types/character";
import type { AttributeKey, GameData } from "../types/gameData";

const MAX_SKILL_ROWS = 12;
const MAX_ATTACK_ROWS = 8;
const MAX_POWER_ROWS = 12;
const MAX_INVENTORY_ROWS = 20;

function clean(value: string | number | boolean | undefined | null) {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\r?\n/g, " ").trim();
}

function getModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function getAttrModRef(attribute: AttributeKey) {
  switch (attribute) {
    case "STR":
      return "@{str_mod}";
    case "DEX":
      return "@{dex_mod}";
    case "CON":
      return "@{con_mod}";
    case "INT":
      return "@{int_mod}";
    case "WIS":
      return "@{wis_mod}";
    case "CHA":
      return "@{cha_mod}";
    default:
      return "@{str_mod}";
  }
}

function getThemeValue(genreId: string) {
  const normalized = genreId.toLowerCase();
  if (normalized.includes("scifi") || normalized.includes("sci-fi")) return "scifi";
  if (normalized.includes("horror")) return "horror";
  if (normalized.includes("modern")) return "modern";
  if (normalized.includes("pulp")) return "pulp";
  return "fantasy";
}

function makeRepeatingRowId(index: number) {
  return `import${index + 1}`;
}

export function buildRoll20AttributeMap(
  character: CharacterRecord,
  gameData: GameData
): Record<string, string> {
  const cls = gameData.classes.find((c) => c.id === character.classId);

  const skillMap = new Map(gameData.skills.map((skill) => [skill.id, skill]));
  const powerMap = new Map(gameData.powers.map((power) => [power.id, power]));
  const itemMap = new Map(gameData.items.map((item) => [item.id, item]));

  const result: Record<string, string> = {};

  // Header / top section
  result["attr_character_name"] = clean(character.identity.name);
  result["attr_class_race"] = clean(cls?.name ?? character.classId);
  result["attr_sheet_theme"] = clean(getThemeValue(character.genreId));

  // Core stats
  result["attr_level"] = clean(character.level);
  result["attr_pb"] = clean(character.proficiencyBonus);

  // These are not modeled yet in your builder, so export safe defaults/blanks
  result["attr_ac_base"] = "10";
  result["attr_ac_bonus"] = "0";
  result["attr_ac_use_dex"] = "1";
  result["attr_speed"] = "";

  // HP
  result["attr_hp_max"] = clean(character.hp.max);
  result["attr_hp_current"] = clean(character.hp.current);

  // Attributes
  result["attr_str"] = clean(character.attributes.STR);
  result["attr_dex"] = clean(character.attributes.DEX);
  result["attr_con"] = clean(character.attributes.CON);
  result["attr_int"] = clean(character.attributes.INT);
  result["attr_wis"] = clean(character.attributes.WIS);
  result["attr_cha"] = clean(character.attributes.CHA);

  // Derived mods
  result["attr_str_mod"] = clean(getModifier(character.attributes.STR));
  result["attr_dex_mod"] = clean(getModifier(character.attributes.DEX));
  result["attr_con_mod"] = clean(getModifier(character.attributes.CON));
  result["attr_int_mod"] = clean(getModifier(character.attributes.INT));
  result["attr_wis_mod"] = clean(getModifier(character.attributes.WIS));
  result["attr_cha_mod"] = clean(getModifier(character.attributes.CHA));

  // Save profs/bonuses/totals are not modeled separately in your app yet
  const saveAttrs: AttributeKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  for (const attr of saveAttrs) {
    const lower = attr.toLowerCase();
    result[`attr_${lower}_saveprof`] = "";
    result[`attr_${lower}_savebonus`] = "0";
    result[`attr_${lower}_save_total`] = clean(getModifier(character.attributes[attr]));
  }

  // AC / initiative derived fields
  result["attr_ac"] = clean(10 + getModifier(character.attributes.DEX));
  result["attr_init_misc"] = "0";
  result["attr_initiative"] = clean(getModifier(character.attributes.DEX));

  // Repeating skills
  const proficientSkills = character.skills
    .filter((skill) => skill.proficient)
    .slice(0, MAX_SKILL_ROWS);

  for (let i = 0; i < proficientSkills.length; i++) {
    const rowId = makeRepeatingRowId(i);
    const skill = proficientSkills[i];
    const definition = skillMap.get(skill.skillId);
    const attr = definition?.attribute ?? "STR";

    result[`repeating_skills_${rowId}_skillname`] = clean(
      definition?.name ?? skill.skillId
    );
    result[`repeating_skills_${rowId}_skillattr`] = clean(getAttrModRef(attr));
    result[`repeating_skills_${rowId}_skillprof`] = "@{pb}";
    result[`repeating_skills_${rowId}_skillbonus`] = clean(skill.bonus ?? 0);
  }

  // Repeating attacks
  const exportedAttacks = character.attacks.slice(0, MAX_ATTACK_ROWS);

  for (let i = 0; i < exportedAttacks.length; i++) {
    const rowId = makeRepeatingRowId(i);
    const attack = exportedAttacks[i];

    result[`repeating_attacks_${rowId}_attackname`] = clean(attack.name);
    result[`repeating_attacks_${rowId}_attackattr`] = clean(
      getAttrModRef(attack.attribute)
    );
    result[`repeating_attacks_${rowId}_attackprof`] = "@{pb}";
    result[`repeating_attacks_${rowId}_attackbonus`] = clean(attack.bonus ?? 0);
    result[`repeating_attacks_${rowId}_damagedice`] = clean(attack.damage);
    result[`repeating_attacks_${rowId}_damagebonus`] = "0";
  }

  // Repeating powers
  const exportedPowers = character.powers.slice(0, MAX_POWER_ROWS);

  for (let i = 0; i < exportedPowers.length; i++) {
    const rowId = makeRepeatingRowId(i);
    const power = exportedPowers[i];
    const definition = power.powerId ? powerMap.get(power.powerId) : undefined;
    const notes = clean(power.notes ?? definition?.description ?? "");
    const text = notes ? `${power.name} — ${notes}` : power.name;

    result[`repeating_powers_${rowId}_powertext`] = clean(text);
  }

  // Repeating inventory
  const exportedInventory = character.inventory.slice(0, MAX_INVENTORY_ROWS);

  for (let i = 0; i < exportedInventory.length; i++) {
    const rowId = makeRepeatingRowId(i);
    const item = exportedInventory[i];
    const definition = item.itemId ? itemMap.get(item.itemId) : undefined;

    result[`repeating_inventory_${rowId}_itemname`] = clean(item.name);
    result[`repeating_inventory_${rowId}_itemqty`] = clean(item.quantity);
    result[`repeating_inventory_${rowId}_itemnotes`] = clean(
      item.notes ?? definition?.description ?? ""
    );
  }

  return result;
}

export function buildRoll20AttributeMapText(
  character: CharacterRecord,
  gameData: GameData
) {
  const map = buildRoll20AttributeMap(character, gameData);

  return Object.entries(map)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function buildRoll20AttributeMapJson(
  character: CharacterRecord,
  gameData: GameData
) {
  return JSON.stringify(buildRoll20AttributeMap(character, gameData), null, 2);
}