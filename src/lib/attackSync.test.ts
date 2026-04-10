import { describe, expect, it } from "vitest";
import { syncDerivedAttacks } from "./attackSync";
import { syncCampaignDerivedAttackTemplates } from "./derivedAttacks";
import type { CampaignDefinition } from "../types/gameData";
import type { CharacterAttack } from "../types/character";

function makeCampaign(): CampaignDefinition {
  return {
    id: "campaign-1",
    name: "Test Campaign",
    description: "",
    labels: {
      attributes: "Attributes",
      skills: "Skills",
      attacks: "Attacks",
      powers: "Powers",
      inventory: "Inventory",
      className: "Class",
      level: "Level",
      hp: "HP",
    },
    attributeRules: {
      generationMethods: ["manual"],
    },
    classes: [],
    skills: [],
    powers: [
      { id: "p1", name: "Flame Burst", isAttack: true },
      { id: "p2", name: "Ward", isAttack: false },
    ],
    items: [
      { id: "i1", name: "Shock Baton", isAttack: true, stackable: false },
      { id: "i2", name: "Rope", isAttack: false, stackable: false },
    ],
    attackTemplates: [],
  };
}

function makeSelectedAttack(attacks: CharacterAttack[]) {
  return attacks.find((attack) => attack.derivedFromType === "power" && attack.derivedFromId === "p1");
}

describe("syncCampaignDerivedAttackTemplates", () => {
  it("creates attack templates for flagged powers and items", () => {
    const synced = syncCampaignDerivedAttackTemplates(makeCampaign());

    const powerTemplate = synced.attackTemplates.find(
      (attack) => attack.derivedFromType === "power" && attack.derivedFromId === "p1"
    );
    const itemTemplate = synced.attackTemplates.find(
      (attack) => attack.derivedFromType === "item" && attack.derivedFromId === "i1"
    );

    expect(powerTemplate?.damage).toBe("1d6");
    expect(itemTemplate?.damage).toBe("1d6");
  });
});

describe("syncDerivedAttacks", () => {
  it("adds derived attacks from selected flagged sources", () => {
    const campaign = syncCampaignDerivedAttackTemplates(makeCampaign());

    const result = syncDerivedAttacks(
      {
        powers: [{ powerId: "p1", name: "Flame Burst", source: "wizard-choice" }],
        inventory: [],
        attacks: [],
      },
      campaign
    );

    const attack = makeSelectedAttack(result);
    expect(attack).toBeTruthy();
    expect(attack?.damage).toBe("1d6");
    expect(attack?.attribute).toBe("STR");
  });

  it("uses campaign template values for derived attacks", () => {
    const campaign = syncCampaignDerivedAttackTemplates(makeCampaign());
    const template = campaign.attackTemplates.find(
      (attack) => attack.derivedFromType === "power" && attack.derivedFromId === "p1"
    );
    if (!template) throw new Error("template missing");

    template.damage = "2d8";
    template.attribute = "INT";
    template.bonus = 3;

    const result = syncDerivedAttacks(
      {
        powers: [{ powerId: "p1", name: "Flame Burst", source: "wizard-choice" }],
        inventory: [],
        attacks: [],
      },
      campaign
    );

    const attack = makeSelectedAttack(result);
    expect(attack?.damage).toBe("2d8");
    expect(attack?.attribute).toBe("INT");
    expect(attack?.bonus).toBe(3);
  });

  it("removes derived attacks when source is unselected", () => {
    const campaign = syncCampaignDerivedAttackTemplates(makeCampaign());

    const existing: CharacterAttack[] = [
      {
        id: "a1",
        derivedFromType: "power",
        derivedFromId: "p1",
        templateId: campaign.attackTemplates[0]?.id,
        name: "Flame Burst",
        attribute: "STR",
        damage: "1d6",
        bonus: 0,
      },
    ];

    const result = syncDerivedAttacks(
      {
        powers: [],
        inventory: [],
        attacks: existing,
      },
      campaign
    );

    expect(result).toHaveLength(0);
  });

  it("preserves user edits for existing derived attacks", () => {
    const campaign = syncCampaignDerivedAttackTemplates(makeCampaign());

    const existing: CharacterAttack[] = [
      {
        id: "a1",
        derivedFromType: "power",
        derivedFromId: "p1",
        templateId: campaign.attackTemplates[0]?.id,
        name: "Flame Burst",
        attribute: "STR",
        damage: "9d9",
        bonus: 7,
      },
    ];

    const result = syncDerivedAttacks(
      {
        powers: [{ powerId: "p1", name: "Flame Burst", source: "wizard-choice" }],
        inventory: [],
        attacks: existing,
      },
      campaign
    );

    expect(result[0]?.damage).toBe("9d9");
    expect(result[0]?.bonus).toBe(7);
  });

  it("backfills linkage by templateId for old saved attacks", () => {
    const campaign = syncCampaignDerivedAttackTemplates(makeCampaign());
    const template = campaign.attackTemplates.find(
      (attack) => attack.derivedFromType === "power" && attack.derivedFromId === "p1"
    );
    if (!template) throw new Error("template missing");

    const existing: CharacterAttack[] = [
      {
        id: "old-a1",
        templateId: template.id,
        name: template.name,
        attribute: template.attribute,
        damage: template.damage,
        bonus: template.bonus ?? 0,
      },
    ];

    const result = syncDerivedAttacks(
      {
        powers: [],
        inventory: [],
        attacks: existing,
      },
      campaign
    );

    expect(result).toHaveLength(0);
  });
});
