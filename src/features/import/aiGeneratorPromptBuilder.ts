import type { CampaignDefinition } from "../../types/gameData";
import { NPC_IMPORT_FORMAT, NPC_IMPORT_SCHEMA_FIELDS, NPC_IMPORT_VERSION } from "./npcImportTypes";
import { buildCampaignGeneratorPrompt } from "./campaignGeneratorPromptBuilder";
import { buildNpcImportPrompt } from "./npcImportPromptBuilder";

export type AiGeneratorMode = "content-only" | "npc-roster" | "campaign-package";

function compactText(value: string | undefined, maxLength = 160) {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

function stringifyList(values: unknown) {
  return JSON.stringify(values, null, 2);
}

function summarizeCampaignContext(campaign: CampaignDefinition) {
  return {
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
}

function buildContentOnlyPrompt(input: {
  campaign: CampaignDefinition;
  sourceMaterial: string;
  selectedSections: Array<"skills" | "powers" | "items" | "attacks" | "races" | "classes">;
  extraInstructions: string;
}) {
  const { campaign, sourceMaterial, selectedSections, extraInstructions } = input;
  const existingContext = summarizeCampaignContext(campaign);
  const fieldsList = Object.entries(NPC_IMPORT_SCHEMA_FIELDS)
    .map(([entity, fields]) => `${entity}: ${fields.join(", ")}`)
    .join("\n");
  const requested = selectedSections.length > 0 ? selectedSections.join(", ") : "skills, powers, items, attacks, races, classes";

  return `You are helping me generate a Character Builder CONTENT UPDATE package for an EXISTING campaign.

TARGET CAMPAIGN:
- Name: ${campaign.name}
- Campaign ID: ${campaign.id}

PRIMARY GOAL:
- Generate content for these sections only: ${requested}
- Do NOT generate any characters in this run.
- This package must be safe to import into an existing campaign and should expand that campaign's content library.

STRICT OUTPUT REQUIREMENTS:
- Return ONLY valid JSON.
- Do NOT include markdown.
- Do NOT include code fences.
- Do NOT include commentary.
- Do NOT include trailing commas.
- Use format exactly: ${NPC_IMPORT_FORMAT}
- Use version exactly: ${NPC_IMPORT_VERSION}
- Reuse existing campaign values by exact name whenever possible.
- Create new values only when they meaningfully add coverage.
- Keep descriptions concise.
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

CONTENT-SCOPE RULES:
- Populate ONLY the requested sections (${requested}) unless cross-references require minimal support entries.
- Keep content.characters as an empty array [] for this mode.
- If classes or races are generated, ensure they are playable and coherent with existing campaign rules.
- For classes, include concrete defaultPowerNames/defaultItemNames/startingAttackNames and concrete choose counts for skillChoiceRules/powerChoiceRules/itemChoiceRules when applicable.

ATTACK DUPLICATION RULES:
- Powers with isAttack=true automatically generate their own attack. Do NOT duplicate them in content.attacks.
- Items with isAttack=true automatically generate their own attack. Do NOT duplicate them in content.attacks.

EXISTING CAMPAIGN CONTEXT (prefer reusing these names when they fit):
${stringifyList(existingContext)}

SOURCE MATERIAL:
${sourceMaterial.trim() || "(No source material provided)"}

ADDITIONAL INSTRUCTIONS:
${extraInstructions.trim() || "(None)"}`;
}

export function buildAiGeneratorPrompt(input: {
  campaign: CampaignDefinition;
  sourceMaterial: string;
  mode: AiGeneratorMode;
  npcCount: number;
  selectedSections: Array<"skills" | "powers" | "items" | "attacks" | "races" | "classes">;
  extraInstructions: string;
}) {
  const { campaign, sourceMaterial, mode, npcCount, selectedSections, extraInstructions } = input;

  if (mode === "campaign-package") {
    const base = buildCampaignGeneratorPrompt({ campaign, sourceMaterial });
    const extra = extraInstructions.trim();
    if (!extra) return base;
    return `${base}\n\nADDITIONAL INSTRUCTIONS:\n${extra}`;
  }

  if (mode === "npc-roster") {
    const base = buildNpcImportPrompt({ campaign, sourceMaterial });
    const rosterCount = Number.isFinite(npcCount) ? Math.max(1, Math.floor(npcCount)) : 6;
    const extra = extraInstructions.trim();
    return `${base}\n\nNPC ROSTER MODE OVERRIDES:\n- Generate exactly ${rosterCount} NPC characters in content.characters.\n- Keep the package focused on supporting that roster (do not generate an oversized campaign ruleset unless the source explicitly asks).\n- Ensure all generated NPCs are immediately playable and reference valid class/race/content names in this payload.\n${extra ? `\nADDITIONAL INSTRUCTIONS:\n${extra}` : ""}`;
  }

  return buildContentOnlyPrompt({
    campaign,
    sourceMaterial,
    selectedSections,
    extraInstructions,
  });
}