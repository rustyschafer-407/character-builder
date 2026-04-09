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

function getThemeValue(campaignId: string) {
  const normalized = campaignId.toLowerCase();
  if (normalized.includes("scifi") || normalized.includes("sci-fi")) return "scifi";
  if (normalized.includes("horror")) return "horror";
  if (normalized.includes("modern")) return "modern";
  if (normalized.includes("pulp")) return "pulp";
  return "fantasy";
}

function makeRepeatingRowId(index: number) {
  return `-cbrow${index + 1}`;
}

export function buildRoll20AttributeMap(
  character: CharacterRecord,
  gameData: GameData
): Record<string, string> {
  const campaign = gameData.campaigns.find((campaign) => campaign.id === character.campaignId);
  const cls = campaign?.classes.find((c) => c.id === character.classId);

  const skillMap = new Map((campaign?.skills ?? []).map((skill) => [skill.id, skill]));
  const powerMap = new Map((campaign?.powers ?? []).map((power) => [power.id, power]));
  const itemMap = new Map((campaign?.items ?? []).map((item) => [item.id, item]));

  const result: Record<string, string> = {};

  function setRepeatingValue(
    sectionNames: string[],
    rowId: string,
    fieldNames: string[],
    value: string
  ) {
    for (const sectionName of sectionNames) {
      for (const fieldName of fieldNames) {
        result[`repeating_${sectionName}_${rowId}_${fieldName}`] = value;
      }
    }
  }

  // Header / top section
  result["attr_character_name"] = clean(character.identity.name);
  result["attr_class_race"] = clean(cls?.name ?? character.classId);
  result["attr_sheet_theme"] = clean(getThemeValue(character.campaignId));

  // Core stats
  result["attr_level"] = clean(character.level);
  result["attr_pb"] = clean(character.proficiencyBonus);

  // These are not modeled yet in your builder, so export safe defaults/blanks
  result["attr_ac_base"] = "10";
  result["attr_ac_bonus"] = "0";
  result["attr_ac_use_dex"] = "1";
  result["attr_speed"] = "";

  // HP
  result["attr_hp"] = clean(character.hp.max);
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
    const sections = ["skills", "skill"];

    const skillName = clean(definition?.name ?? skill.skillId);
    const skillAttr = clean(getModifier(character.attributes[attr]));
    const skillProf = clean(character.proficiencyBonus);
    const skillBonus = clean(skill.bonus ?? 0);

    setRepeatingValue(sections, rowId, ["skillname", "name"], skillName);
    setRepeatingValue(sections, rowId, ["skillattr", "attr"], skillAttr);
    setRepeatingValue(sections, rowId, ["skillprof", "prof"], skillProf);
    setRepeatingValue(sections, rowId, ["skillbonus", "bonus"], skillBonus);
  }

  // Repeating attacks
  const exportedAttacks = character.attacks.slice(0, MAX_ATTACK_ROWS);

  for (let i = 0; i < exportedAttacks.length; i++) {
    const rowId = makeRepeatingRowId(i);
    const attack = exportedAttacks[i];
    const sections = ["attacks", "attack"];

    const attackName = clean(attack.name);
    const attackAttr = clean(getModifier(character.attributes[attack.attribute]));
    const attackProf = clean(character.proficiencyBonus);
    const attackBonus = clean(attack.bonus ?? 0);
    const damageDice = clean(attack.damage);

    setRepeatingValue(sections, rowId, ["attackname", "name"], attackName);
    setRepeatingValue(sections, rowId, ["attackattr", "attr"], attackAttr);
    setRepeatingValue(sections, rowId, ["attackprof", "prof"], attackProf);
    setRepeatingValue(sections, rowId, ["attackbonus", "bonus"], attackBonus);
    setRepeatingValue(sections, rowId, ["damagedice", "damage"], damageDice);
    setRepeatingValue(sections, rowId, ["damagebonus"], "0");
  }

  // Repeating powers
  const exportedPowers = character.powers.slice(0, MAX_POWER_ROWS);

  for (let i = 0; i < exportedPowers.length; i++) {
    const rowId = makeRepeatingRowId(i);
    const power = exportedPowers[i];
    const definition = power.powerId ? powerMap.get(power.powerId) : undefined;
    const notes = clean(power.notes ?? definition?.description ?? "");
    const text = notes ? `${power.name} - ${notes}` : power.name;
    const sections = ["powers", "power"];
    const powerName = clean(power.name);
    const powerNotes = clean(notes);
    const powerText = clean(text);

    setRepeatingValue(sections, rowId, ["powertext", "text"], powerText);
    setRepeatingValue(sections, rowId, ["powername", "name"], powerName);
    setRepeatingValue(sections, rowId, ["powernotes", "notes"], powerNotes);
  }

  // Repeating inventory
  const exportedInventory = character.inventory.slice(0, MAX_INVENTORY_ROWS);

  for (let i = 0; i < exportedInventory.length; i++) {
    const rowId = makeRepeatingRowId(i);
    const item = exportedInventory[i];
    const definition = item.itemId ? itemMap.get(item.itemId) : undefined;
    const sections = ["inventory", "item", "items"];

    const itemName = clean(item.name);
    const itemQty = clean(item.quantity);
    const itemNotes = clean(item.notes ?? definition?.description ?? "");

    setRepeatingValue(sections, rowId, ["itemname", "name"], itemName);
    setRepeatingValue(sections, rowId, ["itemqty", "qty", "quantity"], itemQty);
    setRepeatingValue(sections, rowId, ["itemnotes", "notes"], itemNotes);
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

export function buildChatSetAttrCommand(
  character: CharacterRecord,
  gameData: GameData
): string {
  const map = buildRoll20AttributeMap(character, gameData);

  const pairs = Object.entries(map)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => {
      // Regular attributes are stored as "attr_foo" in the map but Roll20 uses "foo"
      const attrName = key.startsWith("attr_") ? key.slice(5) : key;
      // Escape characters that can break ChatSetAttr parsing
      const safeValue = String(value)
        .replace(/\|/g, "&#124;")
        .replace(/--/g, "&#45;&#45;")
        .replace(/\n/g, " ");
      return `--${attrName}|${safeValue}`;
    });

  return `!setattr --sel ${pairs.join(" ")}`;
}