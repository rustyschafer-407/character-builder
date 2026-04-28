import type { CampaignDefinition } from "../../types/gameData";
import { NPC_IMPORT_FORMAT, NPC_IMPORT_SCHEMA_FIELDS, NPC_IMPORT_VERSION } from "./npcImportTypes";

function compactText(value: string | undefined, maxLength = 160) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function stringifyList(values: unknown) {
  return JSON.stringify(values, null, 2);
}

export function buildCampaignGeneratorPrompt(input: {
  campaign: CampaignDefinition;
  sourceMaterial: string;
}) {
  const { campaign, sourceMaterial } = input;

  const existingContext = {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: compactText(campaign.description),
      labels: campaign.labels,
      attributeRules: campaign.attributeRules,
    },
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
      attributeBonuses: entry.attributeBonuses,
      defaultPowerIds: entry.defaultPowerIds ?? [],
      availableClassIds: entry.availableClassIds ?? [],
    })),
    classes: campaign.classes.map((entry) => ({
      id: entry.id,
      name: entry.name,
      hitDie: entry.hpRule.hitDie,
      hitDiceAtLevel1: entry.hpRule.hitDiceAtLevel1,
      description: compactText(entry.description),
      attributeBonuses: entry.attributeBonuses,
      startingAttackTemplateIds: entry.startingAttackTemplateIds ?? [],
      defaultPowerIds: entry.defaultPowerIds ?? [],
      defaultItemIds: entry.defaultItemIds ?? [],
    })),
  };

  const fieldsList = Object.entries(NPC_IMPORT_SCHEMA_FIELDS)
    .map(([entity, fields]) => `${entity}: ${fields.join(", ")}`)
    .join("\n");

  return `You are helping me generate a rich Character Builder campaign package.

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
- The payload must be coherent as a single campaign world package.
- Reuse existing campaign values by exact name whenever possible.
- If the current campaign is blank or skeletal, generate the missing content needed to make it playable.
- Keep descriptions concise and implementation-focused.
- Do not include long copyrighted passages; summarize rules text into short original descriptions.

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

CAMPAIGN GENERATION GOALS:
- Build a complete, genre-appropriate campaign rules package from the user prompt.
- Create skills, powers, items, attacks, classes, and races that fit the described world and tone.
- Use your knowledge of RPG genres and games to infer what a good campaign in this style needs.
- Create a setting that feels internally coherent rather than generic.
- Classes should have appropriate attribute bonuses, hit dice, starting attacks, default powers, and default items.
- Races should have appropriate attribute bonuses, default powers, and available class names when relevant.
- Characters must all be NPCs. Create exactly 12 initial NPCs representing monsters, enemies, rivals, hazards, or common opponents appropriate to the campaign.
- Ensure those NPCs reference the classes, races, attacks, powers, items, and skills from the same generated package.
- Vary the NPC roster so it includes common foes, tougher elites, and at least one leader or signature threat.

CLASS DESIGN RULES:
- Each class should represent a core archetype in the campaign world.
- Populate attributeBonuses with meaningful stat bonuses for that class.
- Set hitDie and hitDiceAtLevel1 to values that fit the class fantasy.
- startingAttackNames should list any starting weapon or attack templates that every member of the class can use.
- defaultPowerNames should include signature class abilities or spells.
- defaultItemNames should include standard equipment for the class.

RACE DESIGN RULES:
- Each race should represent a species, lineage, ancestry, or equivalent faction identity in the setting.
- Populate attributeBonuses with meaningful stat bonuses for the race.
- defaultPowerNames should include innate traits when appropriate.
- availableClassNames should only be used when the setting strongly implies race/class restrictions or affinities.

NPC ROSTER RULES:
- Create exactly 12 entries in characters.
- Every character type must be NPC.
- Spread levels and power appropriately for the setting.
- Use concrete names and roles instead of placeholders.
- Each NPC should feel like it belongs in the described world.

ATTRIBUTE AND DAMAGE GUIDANCE:
- Use the same style of practical RPG attribute estimation as the NPC generator.
- Give every attack-capable power, item, or attack template a usable damage expression.
- Prefer concise dice notation such as "1d6", "1d8+2", or "2d6".

ATTACK DUPLICATION RULES:
- Powers with isAttack=true automatically generate their own attack. Do NOT duplicate them in content.attacks.
- Items with isAttack=true automatically generate their own attack. Do NOT duplicate them in content.attacks.
- Do NOT list an isAttack power or item name in characters[].attacks. Add it only to characters[].powers or characters[].items.
- Only create standalone content.attacks entries for attacks that are not already represented by an attacking power or item.

REFERENCE RULES:
- In characters.skills/powers/items/attacks, use names.
- In characters.race and characters.class, use names.
- Reuse existing campaign values by exact name whenever they already fit.
- Only add new campaign values when required for the generated setting.

DATA TYPE NOTES:
- attributeBonuses: MUST be an array like [{ "attribute": "STR", "amount": 2 }]
- availableClassNames, defaultPowerNames, defaultItemNames, startingAttackNames: arrays of strings
- tags: arrays of strings
- characters.items may be strings or objects with name, quantity, and notes

EXISTING CAMPAIGN CONTEXT (prefer reusing these names when they fit):
${stringifyList(existingContext)}

SOURCE MATERIAL:
${sourceMaterial.trim() || "(No source material provided)"}`;
}