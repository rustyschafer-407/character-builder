import type { CampaignDefinition } from "../../types/gameData";
import { NPC_IMPORT_FORMAT, NPC_IMPORT_SCHEMA_FIELDS, NPC_IMPORT_VERSION } from "./npcImportTypes";

function compactText(value: string | undefined, maxLength = 140) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function stringifyList(values: unknown) {
  return JSON.stringify(values, null, 2);
}

export function buildNpcImportPrompt(input: {
  campaign: CampaignDefinition;
  sourceMaterial: string;
}) {
  const { campaign, sourceMaterial } = input;

  const existingContext = {
    skills: campaign.skills.map((entry) => ({
      id: entry.id,
      name: entry.name,
      attribute: entry.attribute,
      description: compactText(entry.description),
    })),
    powers: campaign.powers.map((entry) => ({
      id: entry.id,
      name: entry.name,
      level: entry.level ?? 1,
      isAttack: Boolean(entry.isAttack),
      saveAttribute: entry.saveAttribute ?? "",
      description: compactText(entry.description),
    })),
    items: campaign.items.map((entry) => ({
      id: entry.id,
      name: entry.name,
      isAttack: Boolean(entry.isAttack),
      description: compactText(entry.description),
    })),
    attacks: campaign.attackTemplates.map((entry) => ({
      id: entry.id,
      name: entry.name,
      attribute: entry.attribute,
      damage: entry.damage,
      notes: compactText(entry.notes),
    })),
    races: (campaign.races ?? []).map((entry) => ({
      id: entry.id,
      name: entry.name,
      description: compactText(entry.description),
    })),
    classes: campaign.classes.map((entry) => ({
      id: entry.id,
      name: entry.name,
      hitDie: entry.hpRule.hitDie,
      description: compactText(entry.description),
    })),
  };

  const fieldsList = Object.entries(NPC_IMPORT_SCHEMA_FIELDS)
    .map(([entity, fields]) => `${entity}: ${fields.join(", ")}`)
    .join("\n");

  return `You are helping me generate a Character Builder NPC import payload.

TARGET CAMPAIGN:
- Name: ${campaign.name}
- Campaign ID: ${campaign.id}

STRICT OUTPUT REQUIREMENTS:
- Return ONLY valid JSON.
- Do NOT include markdown.
- Do NOT include code fences.
- Do NOT include commentary.
- Do NOT include trailing commas.
- Use format exactly: ${NPC_IMPORT_FORMAT}
- Use version exactly: ${NPC_IMPORT_VERSION}
- Create ONLY the minimum campaign values needed for this NPC.
- Default every generated character type to NPC.
- Reuse existing campaign values by exact name whenever possible.
- Do not create near-duplicate names.
- Keep descriptions concise.
- Do not invent unsupported mechanics.
- Do not include long copyrighted passages; summarize rules text.

VALID OUTPUT FORMAT:
{
  "format": "${NPC_IMPORT_FORMAT}",
  "version": ${NPC_IMPORT_VERSION},
  "content": {
    "skills": [],
    "powers": [],
    "items": [],
    "attacks": [],
    "races": [],
    "classes": [],
    "characters": []
  }
}

VALID FIELDS:
${fieldsList}

DATA TYPE NOTES:
- attributeBonuses: MUST be an empty array [] (not an object {})
- availableClassNames and defaultPowerNames: Arrays of strings (not objects)
- tags: Arrays of strings
- All other array fields (skills, powers, items, attacks, races, classes, characters): Arrays

ATTRIBUTE ESTIMATION (from source material):
When the source material describes an NPC or monster, use your knowledge of RPGs to infer and estimate the character's physical and mental traits. Convert these descriptions into numeric attribute values (typically 3–18 in D&D-like systems):
- STR: Physical strength, carrying capacity, melee damage. High for warriors, brutes, large creatures. Low for wizards, frail beings.
- DEX: Agility, reflexes, initiative, AC. High for rogues, archers, dancers. Low for armored tanks, clumsy creatures.
- CON: Endurance, hit points, fortitude saves. High for fighters, warlocks, tough creatures. Low for glass cannons.
- INT: Reasoning, memory, arcane knowledge. High for wizards, scholars, intelligent spellcasters. Low for animals, mindless creatures.
- WIS: Perception, instinct, divine magic, insight. High for clerics, monks, rangers, perceptive creatures. Low for distractible beings.
- CHA: Force of personality, persuasion, leadership. High for charismatic NPCs, bards, demons, social leaders. Low for recluses, brutes.

Interpret all provided descriptions (size, demeanor, equipment, abilities, role in story) to estimate a reasonable set of attributes that reflect the NPC's described capabilities and nature.

DAMAGE CALCULATION (for all attacks and weapons):
Always compute a damage amount for every attack, power, or item with isAttack=true. Use your knowledge of various RPG systems (D&D, Pathfinder, Starfinder, etc.) to estimate reasonable damage values:
- Melee weapons: Use dice notation like "1d6" (dagger), "1d8" (sword), "1d10" (greatsword), "1d12" (maul). Add half the attribute bonus (e.g., +1 for STR 12-13, +2 for STR 14-15). Round down.
- Ranged weapons: Similar to melee but may vary (shortbow "1d6", longbow "1d8", crossbow "1d8", firearms vary by era/setting).
- Magical/special attacks: Use "1d6", "1d8", or "2d6" depending on power level. Adjust for caster level or NPC level.
- Ammunition description: Always populate the "damage" field in powers/items/attacks with a clear dice notation (e.g., "1d8+2", "2d6", "1d4+1").
- If the source material provides explicit damage, use that; otherwise, infer reasonable damage based on the NPC's role, level, and weapon description.

Example conversions:
- "Fiery blast" with INT 14 → "2d6" or "1d8+2"
- "Enchanted dagger" → "1d4+1"
- "Dragon's claw" → "1d8+3" or "2d6+2"
- "Laser rifle" → "2d8" or "3d6"

REFERENCE RULES:
- In characters.skills/powers/items/attacks, use names.
- In characters.race and characters.class, use names.
- If a referenced name already exists in campaign context below, reuse it.
- Only add new entries under skills/powers/items/attacks/races/classes when required.

ATTACK DUPLICATION RULES (critical — read carefully):
- Powers with isAttack=true automatically generate their own attack. Do NOT also add an entry in content.attacks for that same attack.
- Items with isAttack=true automatically generate their own attack. Do NOT also add an entry in content.attacks for that same attack.
- Do NOT list an isAttack power or item name in characters[0].attacks — add it only to characters[0].powers or characters[0].items. The attack will be derived automatically.
- Only add entries to content.attacks for standalone weapon/attack templates that are NOT represented by a power or item with isAttack=true.
- If you are unsure whether something is a power or a weapon attack, prefer modelling it as a power with isAttack=true and omitting it from content.attacks entirely.

EXISTING CAMPAIGN CONTEXT (prefer reusing these names):
${stringifyList(existingContext)}

SOURCE MATERIAL:
${sourceMaterial.trim() || "(No source material provided)"}
`;
}
