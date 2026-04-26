export const CAMPAIGN_IMPORT_AI_PROMPT = `You are helping me create a Character Builder campaign content import JSON file.

I will provide source material as pasted text, OCR text, notes, or an image. Extract usable campaign content and convert it into valid JSON for this format:

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
Format the response so it can be copied in one click from the AI tool and pasted directly into Character Builder Import.

You may create any combination of:
- powers
- skills
- items

If a category has no entries, return it as an empty array.

General rules:
- Preserve original names as closely as possible.
- Do not invent content that is not supported by the source.
- Keep descriptions concise but complete.
- Use plain text only.
- Do not copy long copyrighted passages verbatim. Summarize rules text into short usable descriptions.
- If multiple entries are visible, extract all clear entries.
- Ignore page numbers, headers, footers, ads, decorative text, and unrelated prose.
- Every object must have a non-empty name.
- Use true/false booleans for usableAsAttack.
- Leave unknown values as empty strings.
- Do not include unsupported fields.
- Do not include comments.
- Do not include trailing commas.
- Ensure the JSON parses correctly.

Skill object fields:

{
  "name": "",
  "attribute": ""
}

Skill interpretation rules:
- Use skills for trained abilities, proficiencies, knowledge areas, professions, social abilities, technical skills, or task-resolution categories.
- attribute should be the most likely linked attribute if the source implies one.
- If no attribute is obvious, leave attribute blank.

Power object fields:

{
  "name": "",
  "level": "",
  "usesPerDay": "",
  "powerAttribute": "",
  "attackAttribute": "",
  "usableAsAttack": false,
  "description": ""
}

Power interpretation rules:
- Use powers for spells, supernatural abilities, class abilities, talents, disciplines, special actions, combat maneuvers, psionics, mutations, gifts, techniques, or other active abilities.
- level should capture the level, rank, tier, prerequisite level, or minimum level if present.
- usesPerDay should capture limits such as at will, once per day, 3/day, per session, costs, charges, cooldowns, or similar. If no usage limit is present, leave it blank.
- powerAttribute should capture the governing attribute, discipline group, school, source, or power family if present.
- attackAttribute should be the best attack stat when known. Use STR for melee attacks and DEX for ranged attacks unless the source clearly indicates a different core attribute.
- Set usableAsAttack to true if the power deals damage, lists damage dice, makes an attack, grants an attack, or is clearly used offensively.
- If the power lists damage dice, include those dice in the description.
- Do not add a separate damage field.
- description should summarize the effect in a short usable form.

Item object fields:

{
  "name": "",
  "attackAttribute": "",
  "usableAsAttack": false,
  "description": ""
}

Item interpretation rules:
- Use items for equipment, weapons, armor, gear, consumables, tools, vehicles, treasure, artifacts, cyberware, magic items, ammunition, or other inventory objects.
- attackAttribute should be the best attack stat when known. Use STR for melee weapons and DEX for ranged weapons unless the source clearly indicates a different core attribute.
- Set usableAsAttack to true if the item is used to attack, lists damage dice, has attack rules, grants an attack, or has obvious combat use as a weapon.
- If the item lists damage dice, include those dice in the description.
- If the item is armor or protective gear, do not mark usableAsAttack true unless it also has an attack.
- description should summarize the item’s function.
- Do not add separate fields for damage, range, cost, weight, quantity, tags, notes, source, or category.

Output quality rules:
- The JSON must parse successfully.
- Use only the supported fields listed above.
- Do not add tags, notes, category, source, damage, damageType, range, saveAttribute, quantity, weight, cost, attack, or any other extra fields.
- Do not wrap the JSON in markdown.

Now wait for me to provide the source material.`;
