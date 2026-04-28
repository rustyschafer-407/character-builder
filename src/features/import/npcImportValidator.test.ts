import { describe, expect, it } from "vitest";
import { makeBlankCampaign } from "../../lib/campaigns";
import { buildNpcImportPrompt } from "./npcImportPromptBuilder";
import { applyNpcImport, buildNpcImportPreview } from "./npcImportValidator";

function makeCampaign() {
  const base = makeBlankCampaign();
  return {
    ...base,
    id: "campaign-1",
    name: "Test Campaign",
    classes: [
      {
        id: "class-fighter",
        campaignId: "campaign-1",
        name: "Fighter",
        description: "Frontline",
        attributeBonuses: [],
        hpRule: {
          hitDie: 10,
          hitDiceAtLevel1: 1,
          level1Mode: "fixed-max" as const,
          levelUpMode: "fixed-average" as const,
          levelUpFixedValue: 6,
        },
        levelProgression: [
          {
            level: 2,
            hitDiceGained: 1,
            hpGainMode: "half" as const,
            proficiencyBonus: 2,
            newSkillChoices: 0,
            newPowerChoices: 0,
            attributeBonuses: [],
          },
        ],
        startingAttackTemplateIds: [],
        defaultPowerIds: [],
        defaultItemIds: [],
        skillChoiceRules: [],
        powerChoiceRules: [],
        itemChoiceRules: [],
        levelUpSkillChoiceRules: [],
        levelUpPowerChoiceRules: [],
        levelUpItemChoiceRules: [],
      },
    ],
    races: [
      {
        id: "race-human",
        campaignId: "campaign-1",
        name: "Human",
        description: "Adaptable",
        attributeBonuses: [],
        defaultPowerIds: [],
        availableClassIds: [],
      },
    ],
    skills: [
      {
        id: "skill-perception",
        name: "Perception",
        attribute: "WIS" as const,
        description: "Notice details",
        tags: [],
      },
    ],
    powers: [],
    items: [],
    attackTemplates: [],
    availableClassIds: ["class-fighter"],
    availableRaceIds: ["race-human"],
    availableSkillIds: ["skill-perception"],
  };
}

describe("npcImport", () => {
  it("builds a campaign-aware prompt", () => {
    const prompt = buildNpcImportPrompt({
      campaign: makeCampaign(),
      sourceMaterial: "Goblin scout with shortbow",
    });

    expect(prompt).toContain("Test Campaign");
    expect(prompt).toContain("character-builder.npc-import");
    expect(prompt).toContain("VALID FIELDS");
    expect(prompt).toContain("EXISTING CAMPAIGN CONTEXT");
    expect(prompt).toContain("CLASS + BACKGROUND THEMING RULE");
  });

  it("validates and previews a minimal payload", () => {
    const preview = buildNpcImportPreview(
      JSON.stringify({
        format: "character-builder.npc-import",
        version: 1,
        content: {
          skills: [{ name: "Stealth", attribute: "DEX" }],
          powers: [{ name: "Poison Arrow", level: 1, isAttack: true, description: "Ranged strike" }],
          items: [{ name: "Shortbow", isAttack: true, description: "1d6 damage" }],
          attacks: [{ name: "Dagger", attribute: "DEX", damage: "1d4", bonus: 1 }],
          races: [{ name: "Goblin" }],
          classes: [{ name: "Scout", hitDie: 8 }],
          characters: [
            {
              name: "Goblin Runner",
              type: "pc",
              race: "Goblin",
              class: "Scout",
              level: 3,
              attributes: { DEX: 16, CON: 12 },
              skills: ["Perception", "Stealth"],
              powers: ["Poison Arrow"],
              items: ["Shortbow"],
              attacks: ["Dagger"],
            },
          ],
        },
      }),
      makeCampaign()
    );

    expect(preview.characterPlan?.name).toBe("Goblin Runner");
    expect(preview.characterPlan?.type).toBe("npc");
    expect(preview.toCreate.classes.length).toBe(1);
    expect(preview.toCreate.races.length).toBe(1);
    expect(preview.warnings.some((warning) => warning.code === "forced-character-type")).toBe(true);
  });

  it("applies preview and creates an NPC draft", () => {
    const campaign = makeCampaign();
    const preview = buildNpcImportPreview(
      JSON.stringify({
        format: "character-builder.npc-import",
        version: 1,
        content: {
          skills: [{ name: "Stealth", attribute: "DEX" }],
          powers: [{ name: "Poison Arrow", level: 1, isAttack: true, description: "1d8 damage" }],
          items: [{ name: "Shortbow", isAttack: true, description: "1d6 damage" }],
          characters: [
            {
              name: "Night Archer",
              class: "Fighter",
              race: "Human",
              skills: ["Stealth", "Perception"],
              powers: ["Poison Arrow"],
              items: [{ name: "Shortbow", quantity: 1 }],
            },
          ],
        },
      }),
      campaign
    );

    const result = applyNpcImport(campaign, preview);

    expect(result.campaign.skills.some((entry) => entry.name === "Stealth")).toBe(true);
    expect(result.campaign.powers.some((entry) => entry.name === "Poison Arrow")).toBe(true);
    expect(result.draft.characterType).toBe("npc");
    expect(result.draft.identity.name).toBe("Night Archer");
    expect(result.draft.classId).toBe("class-fighter");
    expect(result.draft.skills.some((entry) => entry.proficient)).toBe(true);
  });

  it("supports campaign-scale payloads with multiple NPC drafts", () => {
    const campaign = makeCampaign();
    const preview = buildNpcImportPreview(
      JSON.stringify({
        format: "character-builder.npc-import",
        version: 1,
        content: {
          skills: [{ name: "Tactics", attribute: "INT" }],
          classes: [{ name: "Officer", hitDie: 8 }],
          races: [{ name: "Andorian" }],
          characters: [
            {
              name: "Commander Thalek",
              class: "Officer",
              race: "Andorian",
              skills: ["Tactics"],
            },
            {
              name: "Security Drone",
              class: "Fighter",
              race: "Human",
              skills: ["Perception"],
            },
          ],
        },
      }),
      campaign
    );

    const result = applyNpcImport(campaign, preview);

    expect(preview.characterPlans).toHaveLength(2);
    expect(preview.characterPlans[0]?.name).toBe("Commander Thalek");
    expect(result.drafts).toHaveLength(2);
    expect(result.drafts[0]?.identity.name).toBe("Commander Thalek");
    expect(result.drafts[1]?.identity.name).toBe("Security Drone");
    expect(result.campaign.classes.some((entry) => entry.name === "Officer")).toBe(true);
    expect(result.campaign.races?.some((entry) => entry.name === "Andorian")).toBe(true);
  });

  it("applies playable class and race metadata from import payload", () => {
    const campaign = makeCampaign();
    const preview = buildNpcImportPreview(
      JSON.stringify({
        format: "character-builder.npc-import",
        version: 1,
        content: {
          skills: [
            { name: "Arcana", attribute: "INT" },
            { name: "Insight", attribute: "WIS" },
          ],
          powers: [
            { name: "Fire Bolt", level: 1, isAttack: true, description: "1d8 fire" },
            { name: "Shield Ward", level: 1, description: "Magical ward" },
          ],
          items: [
            { name: "Spellbook", description: "Arcane notes" },
            { name: "Wand", isAttack: true, description: "1d6 force" },
          ],
          attacks: [{ name: "Quarterstaff", attribute: "STR", damage: "1d6" }],
          races: [
            {
              name: "Elf",
              attributeBonuses: [{ attribute: "DEX", amount: 2 }],
              defaultPowerNames: ["Shield Ward"],
              availableClassNames: ["Mage"],
            },
          ],
          classes: [
            {
              name: "Mage",
              hitDie: 6,
              hitDiceAtLevel1: 1,
              attributeBonuses: [{ attribute: "INT", amount: 2 }],
              defaultPowerNames: ["Fire Bolt"],
              defaultItemNames: ["Spellbook"],
              startingAttackNames: ["Quarterstaff"],
              skillChoiceRules: [{ choose: 1, skillNames: ["Arcana", "Insight"] }],
              powerChoiceRules: [{ choose: 1, powerNames: ["Fire Bolt", "Shield Ward"] }],
              itemChoiceRules: [{ choose: 1, itemNames: ["Spellbook", "Wand"] }],
            },
          ],
          characters: [{ name: "Apprentice Duelist", class: "Mage", race: "Elf" }],
        },
      }),
      campaign
    );

    const result = applyNpcImport(campaign, preview);
    const mage = result.campaign.classes.find((entry) => entry.name === "Mage");
    const elf = result.campaign.races?.find((entry) => entry.name === "Elf");

    expect(mage).toBeTruthy();
    expect(mage?.defaultPowerIds?.length).toBe(1);
    expect(mage?.defaultItemIds?.length).toBe(1);
    expect(mage?.startingAttackTemplateIds?.length).toBe(1);
    expect(mage?.skillChoiceRules?.[0]?.choose).toBe(1);
    expect(mage?.powerChoiceRules?.[0]?.choose).toBe(1);
    expect(mage?.itemChoiceRules?.[0]?.choose).toBe(1);

    expect(elf).toBeTruthy();
    expect(elf?.defaultPowerIds?.length).toBe(1);
    expect(elf?.availableClassIds?.length).toBe(1);
  });
});
