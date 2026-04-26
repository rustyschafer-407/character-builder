export const CAMPAIGN_IMPORT_AI_PROMPT = `You are helping me create a Character Builder campaign content import JSON file.

I will provide source material as pasted text, OCR text, notes, or an image. Extract any usable campaign content and convert it into valid JSON for this format:

{
  "format": "character-builder.campaign-content-import",
  "version": 1,
  "content": {
    "powers": [],
    "skills": [],
    "items": []
  }
}

Return ONLY valid JSON. Do not include markdown, commentary, explanations, or code fences.

You may create any combination of:
- powers
- skills
- items

Omit empty categories only if the importer allows it. Otherwise return them as empty arrays.

General rules:
- Preserve the original names as closely as possible.
- Do not invent content that is not supported by the source.
- If the source is unclear, make the most reasonable structured interpretation and add uncertainty to the notes field.
- Keep descriptions concise but complete.
- Use plain text only.
- Do not copy long copyrighted passages verbatim. Summarize rules text into short usable descriptions.
- If multiple entries are visible, extract all clear entries.
- Ignore page numbers, headers, footers, ads, decorative text, and unrelated prose.
- If an entry appears incomplete, include it only if it has a clear name and enough useful information.
- Use tags to preserve useful searchable concepts such as fire, psychic, ranged, melee, healing, defensive, magic, tech, horror, social, vehicle, consumable, armor, weapon, etc.
- Use source to identify where the content came from if I provide that information, such as the book name, page number, or pasted note title.

Power object fields:
{
  "name": "",
  "description": "",
  "category": "",
  "uses": "",
  "damage": "",
  "saveAttribute": "",
  "tags": [],
  "source": "",
  "notes": ""
}

Power interpretation rules:
- Use powers for spells, supernatural abilities, class abilities, talents, special actions, combat maneuvers, psionics, mutations, gifts, techniques, or other active abilities.
- category should be a short useful grouping such as Attack, Defense, Utility, Healing, Movement, Social, Passive, Reaction, Ritual, or Other.
- damage should contain dice or damage text if the power deals damage.
- saveAttribute should be filled only if the source mentions a save, resistance roll, defense attribute, or similar mechanic.
- uses should capture limits such as once per day, 3/session, costs 2 energy, at will, requires concentration, cooldown, charges, or similar.
- If the ability is always on, use category Passive and mention that in description or notes.

Skill object fields:
{
  "name": "",
  "description": "",
  "attribute": "",
  "category": "",
  "tags": [],
  "source": "",
  "notes": ""
}

Skill interpretation rules:
- Use skills for trained capabilities, proficiencies, knowledge areas, professions, social abilities, technical skills, or task-resolution categories.
- attribute should be the most likely linked attribute if the source implies one.
- If no attribute is obvious, leave attribute blank and explain uncertainty in notes.
- category should be a short useful grouping such as Physical, Mental, Social, Technical, Knowledge, Combat, Survival, Magic, Vehicle, or Other.

Item object fields:
{
  "name": "",
  "description": "",
  "category": "",
  "quantity": "",
  "weight": "",
  "cost": "",
  "tags": [],
  "source": "",
  "notes": "",
  "usableAsAttack": false
}

Item interpretation rules:
- Use items for equipment, weapons, armor, gear, consumables, tools, vehicles, treasure, artifacts, cyberware, magic items, ammunition, or other inventory objects.
- category should be a short useful grouping such as Weapon, Armor, Gear, Consumable, Tool, Vehicle, Treasure, Magic Item, Tech, Ammunition, or Other.
- If an item lists damage, attack bonus, range, ammo, rate of fire, weapon traits, or any other combat use, set "usableAsAttack": true.
- If usableAsAttack is true, include attack-related details in the description and tags.
- If an item is armor or provides defense, do not mark usableAsAttack unless it also has an attack.
- quantity, weight, and cost should be copied if present. Leave blank if not present.
- If the source lists price, value, credits, gold, dollars, or similar, put it in cost exactly as written.

Output quality rules:
- The JSON must parse successfully.
- Every object must have a non-empty name.
- Use arrays for tags.
- Use true/false booleans for usableAsAttack.
- Do not include comments in the JSON.
- Do not include trailing commas.
- Do not wrap the JSON in markdown.

Now wait for me to provide the source material.`;
