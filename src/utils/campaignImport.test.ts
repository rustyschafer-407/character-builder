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
      description: "Hurl fire.",
    });
  });

  it("accepts a mixed payload and tolerates missing categories", () => {
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Arc Lash", description: "Shock.", level: 1 }],
          skills: [{ name: "Lore", attribute: "INT" }],
          items: [{ name: "Field Kit", "usable as attack flag": false, description: "Supplies." }],
        },
      }),
      makeCampaign()
    );

    expect(preview.powers).toHaveLength(1);
    expect(preview.skills).toHaveLength(1);
    expect(preview.items).toHaveLength(1);
    expect(preview.warnings.some((warning) => warning.message.includes("missing category"))).toBe(true);
    expect(preview.warnings.some((warning) => warning.message.includes("missing description"))).toBe(true);
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
      powers: [{ id: "power-1", name: "Fire Bolt", level: 1, description: "Old power" }],
      availablePowerIds: ["power-1"],
    };
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: { powers: [{ name: "fire bolt", level: 4, description: "Updated" }] },
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
  });

  it("updates duplicates when update mode is selected", () => {
    const campaign = {
      ...makeCampaign(),
      powers: [{ id: "power-1", name: "Fire Bolt", level: 1, description: "Old power" }],
      items: [{ id: "item-1", name: "Torch", description: "Old torch", isAttack: false, stackable: false }],
      availablePowerIds: ["power-1"],
      availableItemIds: ["item-1"],
    };
    const preview = buildCampaignImportPreview(
      stringify({
        format: "character-builder.campaign-content-import",
        version: 1,
        content: {
          powers: [{ name: "Fire Bolt", level: 4, description: "Updated", "uses per day": 2 }],
          items: [{ name: "Torch", description: "Updated torch", "usable as attack flag": true }],
        },
      }),
      campaign
    );

    const result = applyCampaignImport(campaign, preview, "update");

    expect(result.importedCounts.powers).toBe(1);
    expect(result.importedCounts.items).toBe(1);
    expect(result.skippedDuplicates).toBe(0);
    expect(result.campaign.powers[0]).toMatchObject({
      id: "power-1",
      level: 4,
      description: "Updated",
      usesPerDay: 2,
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
});