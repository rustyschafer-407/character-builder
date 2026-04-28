import { describe, expect, it } from "vitest";
import { fantasyCampaign } from "../data/campaigns/fantasy";
import { normalizeCampaignDefinition } from "./domain";
import {
  areItemRulesSatisfiedAtMost,
  arePowerRulesSatisfiedExactly,
  areSkillRulesSatisfiedExactly,
} from "./creationChoiceRules";
import { generateQuickstartConcepts, generateQuickstartDraft } from "./characterQuickstart";

function makeSeededRng(seed = 123456789) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function withSimpleRace() {
  return normalizeCampaignDefinition({
    ...fantasyCampaign,
    races: [
      {
        id: "human",
        campaignId: fantasyCampaign.id,
        name: "Human",
        description: "Adaptable and determined.",
        attributeBonuses: [{ attribute: "CHA", amount: 1 }],
      },
    ],
  });
}

function withDexRace() {
  return normalizeCampaignDefinition({
    ...fantasyCampaign,
    races: [
      {
        id: "elf",
        campaignId: fantasyCampaign.id,
        name: "Elf",
        description: "Graceful and swift.",
        attributeBonuses: [{ attribute: "DEX", amount: 2 }],
      },
    ],
  });
}

describe("characterQuickstart", () => {
  it("generates a valid wizard-compatible draft from campaign data", () => {
    const campaign = normalizeCampaignDefinition(fantasyCampaign);
    const result = generateQuickstartDraft(campaign, {}, makeSeededRng(1));

    expect(result.draft).not.toBeNull();
    const draft = result.draft!;

    expect(draft.campaignId).toBe(campaign.id);
    expect(campaign.classes.some((cls) => cls.id === draft.classId)).toBe(true);
    if ((campaign.races ?? []).length > 0) {
      expect((campaign.races ?? []).some((race) => race.id === draft.raceId)).toBe(true);
    } else {
      expect(draft.raceId).toBe("");
    }

    const cls = campaign.classes.find((candidate) => candidate.id === draft.classId)!;
    expect(areSkillRulesSatisfiedExactly(cls.skillChoiceRules ?? [], draft.skills)).toBe(true);
    expect(arePowerRulesSatisfiedExactly(cls.powerChoiceRules ?? [], draft.powers)).toBe(true);
    expect(areItemRulesSatisfiedAtMost(cls.itemChoiceRules ?? [], draft.inventory)).toBe(true);

    expect(draft.attributeGeneration?.method).toBe("pointBuy");
    expect(Object.values(draft.saveProf).filter(Boolean)).toHaveLength(2);
    expect(draft.hp.max).toBeGreaterThan(0);
  });

  it("respects valid locked race/class choices", () => {
    const campaign = withSimpleRace();
    const result = generateQuickstartDraft(
      campaign,
      {
        raceId: "human",
        classId: "wizard",
        background: "Veteran Tech",
        name: "Locke",
      },
      makeSeededRng(42)
    );

    expect(result.draft).not.toBeNull();
    const draft = result.draft!;

    expect(draft.raceId).toBe("human");
    expect(draft.classId).toBe("wizard");
    expect(draft.identity.background).toBe("Veteran Tech");
    expect(draft.identity.name).toBe("Locke");
  });

  it("falls back safely when a locked choice is invalid", () => {
    const campaign = normalizeCampaignDefinition(fantasyCampaign);
    const result = generateQuickstartDraft(
      campaign,
      {
        raceId: "not-a-race",
        classId: "not-a-class",
      },
      makeSeededRng(9)
    );

    expect(result.draft).not.toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("generates three concept options with draft payloads", () => {
    const campaign = normalizeCampaignDefinition(fantasyCampaign);
    const concepts = generateQuickstartConcepts(campaign, {}, 3, makeSeededRng(99));

    expect(concepts.length).toBe(3);
    for (const concept of concepts) {
      expect(concept.draft.campaignId).toBe(campaign.id);
      expect(concept.attributeFocus.length).toBeGreaterThan(0);
      expect(concept.summary.length).toBeGreaterThan(0);
    }
  });

  it("handles incomplete campaign config defensively", () => {
    const incomplete = normalizeCampaignDefinition({
      id: "broken",
      name: "Broken",
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
        generationMethods: ["pointBuy"],
      },
      classes: [],
      races: [],
      skills: [],
      powers: [],
      items: [],
      attackTemplates: [],
    });

    const result = generateQuickstartDraft(incomplete, {}, makeSeededRng(3));
    expect(result.draft).not.toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.draft?.classId).toBe("");
  });

  it("biases fighter builds toward dex when species strongly boosts dex", () => {
    const campaign = withDexRace();
    const result = generateQuickstartDraft(
      campaign,
      {
        raceId: "elf",
        classId: "fighter",
      },
      makeSeededRng(7)
    );

    expect(result.draft).not.toBeNull();
    const draft = result.draft!;
    expect(draft.attributes.DEX).toBeGreaterThanOrEqual(draft.attributes.STR);
  });

  it("keeps primary and durability attributes playable", () => {
    const campaign = normalizeCampaignDefinition(fantasyCampaign);
    const result = generateQuickstartDraft(
      campaign,
      {
        classId: "wizard",
      },
      makeSeededRng(21)
    );

    expect(result.draft).not.toBeNull();
    const draft = result.draft!;
    expect(draft.attributes.INT).toBeGreaterThanOrEqual(14);
    expect(draft.attributes.CON).toBeGreaterThanOrEqual(12);
  });

  it("still generates concepts when classes are missing", () => {
    const campaign = normalizeCampaignDefinition({
      ...fantasyCampaign,
      classes: [],
    });

    const concepts = generateQuickstartConcepts(campaign, {}, 3, makeSeededRng(15));
    expect(concepts.length).toBe(3);
    for (const concept of concepts) {
      expect(concept.className).toBe("Adventurer");
      expect(concept.draft.classId).toBe("");
    }
  });

  it("assigns class and race when availability lists are empty", () => {
    const campaign = normalizeCampaignDefinition({
      ...fantasyCampaign,
      availableClassIds: [],
      availableRaceIds: [],
    });

    const result = generateQuickstartDraft(campaign, {}, makeSeededRng(33));
    expect(result.draft).not.toBeNull();

    const draft = result.draft!;
    expect(draft.classId).not.toBe("");
    if ((campaign.races ?? []).length > 0) {
      expect(draft.raceId).not.toBe("");
    }
  });

  it("falls back to balanced attributes when point-buy is unusable", () => {
    const campaign = normalizeCampaignDefinition({
      ...fantasyCampaign,
      attributeRules: {
        ...fantasyCampaign.attributeRules,
        pointBuyTotal: 5,
      },
    });

    const result = generateQuickstartDraft(campaign, { classId: "wizard" }, makeSeededRng(22));
    expect(result.draft).not.toBeNull();
    expect(result.draft?.attributeGeneration?.method).toBe("manual");
    expect(result.warnings.some((warning) => warning.toLowerCase().includes("balanced"))).toBe(true);
  });
});
