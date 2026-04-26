import { describe, expect, it } from "vitest";
import { makeBlankCampaign } from "../lib/campaigns";
import type { CampaignContentImportPayload } from "./campaignImport";
import {
  applyCampaignImport,
  buildCampaignImportPreview,
  normalizeImportName,
} from "./campaignImport";

function makeCampaign() {
  return {
    ...makeBlankCampaign(),
    id: "campaign-1",
    name: "Importer Test",
  };
}

function stringify(payload: CampaignContentImportPayload) {
  return JSON.stringify(payload);
}

describe("campaignImport", () => {
  it("accepts a valid powers-only payload", () => {
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [
            {
              name: "Fire Bolt",
              level: 2,
              "uses per day": 3,
              "power attribute": "int",
              usableAsAttack: true,
              description: "Hurl fire.",
            },
          ],
        },
      }),
      makeCampaign()
    );

    expect(preview.powers).toHaveLength(1);
    expect(preview.skills).toHaveLength(0);
    expect(preview.items).toHaveLength(0);
    expect(preview.powers[0]).toMatchObject({
      name: "Fire Bolt",
      level: 2,
      usesPerDay: 3,
      saveAttribute: "INT",
      isAttack: true,
      description: "Hurl fire.",
    });
  });

  it("accepts a mixed payload using supported fields only", () => {
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Arc Lash", description: "Shock.", level: 1, usableAsAttack: false }],
          skills: [{ name: "Lore", attribute: "INT" }],
          items: [{ name: "Field Kit", usableAsAttack: false, description: "Supplies." }],
        },
      }),
      makeCampaign()
    );

    expect(preview.powers).toHaveLength(1);
    expect(preview.skills).toHaveLength(1);
    expect(preview.items).toHaveLength(1);
    expect(preview.warnings.some((warning) => warning.message.includes("missing category"))).toBe(false);
  });

  it("rejects invalid JSON", () => {
    expect(() => buildCampaignImportPreview("{", makeCampaign())).toThrow(
      "Import JSON could not be parsed."
    );
  });

  it("rejects a wrong format", () => {
    expect(() =>
      buildCampaignImportPreview(
        stringify({
          format: "wrong-format",
          version: 1,
          content: { powers: [{ name: "Fire Bolt" }] },
        }),
        makeCampaign()
      )
    ).toThrow("Import format must be character-builder.campaign-content-import.");
  });

  it("rejects missing names", () => {
    expect(() =>
      buildCampaignImportPreview(
        stringify({
          format: "character-builder.campaign-content-import",
          version: 1,
          content: { items: [{ description: "Nameless" }] },
        }),
        makeCampaign()
      )
    ).toThrow("Item 1 is missing a name.");
  });

  it("detects duplicates by normalized name within the selected campaign", () => {
    const campaign = {
      ...makeCampaign(),
      powers: [{ id: "power-1", name: "Fire   Bolt", level: 1, description: "Old" }],
    };

    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: { powers: [{ name: "  fire bolt ", description: "New" }] },
      }),
      campaign
    );

    expect(preview.duplicateCount).toBe(1);
    expect(preview.duplicateCounts.powers).toBe(1);
    expect(normalizeImportName(" Fire   Bolt ")).toBe(normalizeImportName("fire bolt"));
  });

  it("skips duplicates when skip mode is selected", () => {
    const campaign = {
      ...makeCampaign(),
      powers: [{ id: "power-1", name: "Fire Bolt", level: 1, description: "Old power", isAttack: false }],
      availablePowerIds: ["power-1"],
    };
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: { powers: [{ name: "fire bolt", level: 4, description: "Updated", usableAsAttack: true }] },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "skip");

    expect(result.importedCounts.powers).toBe(0);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.campaign.powers[0]).toMatchObject({
      id: "power-1",
      name: "Fire Bolt",
      level: 1,
      description: "Old power",
    });
    expect(result.importedCounts.attacks).toBe(0);
  });

  it("updates duplicates when update mode is selected", () => {
    const campaign = {
      ...makeCampaign(),
      powers: [{ id: "power-1", name: "Fire Bolt", level: 1, description: "Old power", isAttack: false }],
      items: [{ id: "item-1", name: "Torch", description: "Old torch", isAttack: false, stackable: false }],
      availablePowerIds: ["power-1"],
      availableItemIds: ["item-1"],
    };
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Fire Bolt", level: 4, description: "Updated", "uses per day": 2, usableAsAttack: true }],
          items: [{ name: "Torch", description: "Updated torch", usableAsAttack: true }],
        },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "update");

    expect(result.importedCounts.powers).toBe(1);
    expect(result.importedCounts.items).toBe(1);
    expect(result.importedCounts.attacks).toBe(2);
    expect(result.skippedDuplicates).toBe(0);
    expect(result.campaign.powers[0]).toMatchObject({
      id: "power-1",
      level: 4,
      description: "Updated",
      usesPerDay: 2,
      isAttack: true,
    });
    expect(result.campaign.items[0]).toMatchObject({
      id: "item-1",
      description: "Updated torch",
      isAttack: true,
    });
  });

  it("generates warnings for missing optional fields instead of rejecting", () => {
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Signal Burst", mystery: "???" }],
        },
      }),
      makeCampaign()
    );

    expect(preview.powers).toHaveLength(1);
    expect(preview.warnings.some((warning) => warning.message.includes("missing description"))).toBe(true);
    expect(preview.warnings.some((warning) => warning.message.includes("unknown fields"))).toBe(true);
  });

  it("creates a derived attack for powers with usableAsAttack true and damage dice in description", () => {
    const campaign = makeCampaign();
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Blade Arc", description: "Deal 1d8 damage to one target", usableAsAttack: true }],
        },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "skip");
    const attack = result.campaign.attackTemplates.find((entry) => entry.name === "Blade Arc");

    expect(result.importedCounts.attacks).toBe(1);
    expect(attack).toBeTruthy();
    expect(attack?.damage).toBe("1d8");
    expect(attack?.derivedFromType).toBe("power");
  });

  it("creates a derived attack for items with usableAsAttack true and damage dice in description", () => {
    const campaign = makeCampaign();
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          items: [{ name: "War Axe", description: "Heavy strike for 2d6 damage", usableAsAttack: true }],
        },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "skip");
    const attack = result.campaign.attackTemplates.find((entry) => entry.name === "War Axe");

    expect(result.importedCounts.attacks).toBe(1);
    expect(attack).toBeTruthy();
    expect(attack?.damage).toBe("2d6");
    expect(attack?.derivedFromType).toBe("item");
  });

  it("does not create an attack for powers when usableAsAttack is false", () => {
    const campaign = makeCampaign();
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Aura of Calm", description: "Calms nearby creatures", usableAsAttack: false }],
        },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "skip");
    expect(result.importedCounts.attacks).toBe(0);
    expect(result.campaign.attackTemplates.some((entry) => entry.name === "Aura of Calm")).toBe(false);
  });

  it("does not create an attack for items when usableAsAttack is false", () => {
    const campaign = makeCampaign();
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          items: [{ name: "Toolkit", description: "Repair tools", usableAsAttack: false }],
        },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "skip");
    expect(result.importedCounts.attacks).toBe(0);
    expect(result.campaign.attackTemplates.some((entry) => entry.name === "Toolkit")).toBe(false);
  });

  it("skipping duplicate powers also skips associated derived attack creation", () => {
    const campaign = {
      ...makeCampaign(),
      powers: [{ id: "power-1", name: "Rend", description: "Old", isAttack: false }],
      availablePowerIds: ["power-1"],
    };

    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Rend", description: "Deal 1d10 damage", usableAsAttack: true }],
        },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "skip");
    expect(result.skippedDuplicates).toBe(1);
    expect(result.importedCounts.attacks).toBe(0);
    expect(result.campaign.attackTemplates.some((entry) => entry.name === "Rend")).toBe(false);
  });

  it("does not duplicate attacks when an attack with the same normalized name already exists", () => {
    const campaign = {
      ...makeCampaign(),
      attackTemplates: [
        {
          id: "attack-1",
          name: "Fire Bolt",
          attribute: "INT" as const,
          damage: "1d8",
          bonus: 0,
          notes: "Existing",
          tags: [],
        },
      ],
      powers: [],
      items: [],
    };

    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "  fire   bolt ", description: "Deal 1d8 damage", usableAsAttack: true }],
        },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "update");
    expect(result.importedCounts.attacks).toBe(0);
    expect(result.campaign.attackTemplates).toHaveLength(1);
    expect(preview.warnings.some((warning) => warning.message.includes("already exists and will be skipped"))).toBe(true);
  });

  it("supports skills-only payloads", () => {
    const campaign = makeCampaign();
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          skills: [{ name: "Investigation", attribute: "INT" }],
        },
      }),
      campaign
    );
    const result = applyCampaignImport(campaign, preview, "skip");

    expect(result.importedCounts.skills).toBe(1);
    expect(result.importedCounts.powers).toBe(0);
    expect(result.importedCounts.items).toBe(0);
    expect(result.importedCounts.attacks).toBe(0);
  });

  it("existing valid imports without usableAsAttack still work", () => {
    const campaign = makeCampaign();
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Mystic Shield", description: "Protect an ally" }],
          items: [{ name: "Bandage", description: "Stop bleeding" }],
        },
      }),
      campaign
    );
    const result = applyCampaignImport(campaign, preview, "skip");

    expect(result.importedCounts.powers).toBe(1);
    expect(result.importedCounts.items).toBe(1);
    expect(result.importedCounts.attacks).toBe(0);
  });

  it("accepts item usableAsAttack=true and maps it to campaign attack usability", () => {
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          items: [{ name: "Shock Baton", description: "Stuns target", usableAsAttack: true }],
        },
      }),
      makeCampaign()
    );

    expect(preview.items).toHaveLength(1);
    expect(preview.items[0]?.isAttack).toBe(true);
    expect(preview.attacksToCreateByMode.skip).toBe(1);
  });

  it("tolerates item usableAsAttack missing by defaulting to non-attack", () => {
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          items: [{ name: "Med Kit", description: "Field first aid" }],
        },
      }),
      makeCampaign()
    );

    expect(preview.items).toHaveLength(1);
    expect(preview.items[0]?.isAttack).toBe(false);
  });
});