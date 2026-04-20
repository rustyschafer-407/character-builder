import { describe, expect, it } from "vitest";
import { buildRoll20ModPayload } from "./roll20Export";
import type { CharacterRecord } from "../types/character";
import type { CampaignDefinition, ClassDefinition, GameData, RaceDefinition } from "../types/gameData";

function makeClass(campaignId: string): ClassDefinition {
  return {
    id: "class-1",
    campaignId,
    name: "Guardian",
    description: "",
    attributeBonuses: [],
    hpRule: {
      hitDie: 10,
      level1Mode: "fixed-max",
      levelUpMode: "fixed-average",
      levelUpFixedValue: 6,
    },
    levelProgression: [
      {
        level: 2,
        hitDiceGained: 1,
        hpGainMode: "half",
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
  };
}

function makeRace(campaignId: string): RaceDefinition {
  return {
    id: "race-1",
    campaignId,
    name: "Human",
    description: "",
    attributeBonuses: [],
    defaultPowerIds: [],
    availableClassIds: [],
  };
}

function makeCampaign(): CampaignDefinition {
  const campaignId = "campaign-1";
  return {
    id: campaignId,
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
      generationMethods: ["pointBuy", "randomRoll", "manual"],
      pointBuyTotal: 27,
      randomRollFormula: "4d6 drop lowest",
      randomRollCount: 6,
      randomRollDropLowest: 1,
      minimumScore: 3,
      maximumScore: 18,
    },
    classes: [makeClass(campaignId)],
    races: [makeRace(campaignId)],
    skills: [],
    powers: [],
    items: [],
    attackTemplates: [],
    availableClassIds: [],
    availableRaceIds: [],
    availableSkillIds: [],
    availablePowerIds: [],
    availableItemIds: [],
    availableAttackTemplateIds: [],
  };
}

function makeCharacter(): CharacterRecord {
  return {
    id: "char-1",
    identity: {
      name: "Tester",
    },
    campaignId: "campaign-1",
    raceId: "race-1",
    classId: "class-1",
    level: 1,
    proficiencyBonus: 2,
    attributes: {
      STR: 14,
      DEX: 12,
      CON: 13,
      INT: 10,
      WIS: 15,
      CHA: 8,
    },
    attributeGeneration: {
      method: "pointBuy",
      pointBuyTotal: 27,
      rolls: [],
      notes: "",
    },
    hp: {
      max: 12,
      current: 12,
      temp: 0,
      hitDie: 10,
      notes: "",
    },
    sheet: {
      speed: "30",
      acBase: 10,
      acBonus: 0,
      acUseDex: true,
      initMisc: 0,
      saveProf: {
        STR: true,
        DEX: false,
        CON: false,
        INT: false,
        WIS: true,
        CHA: false,
      },
      saveBonus: {
        STR: 0,
        DEX: 0,
        CON: 0,
        INT: 0,
        WIS: 0,
        CHA: 0,
      },
    },
    skills: [],
    powers: [],
    inventory: [],
    attacks: [],
    levelProgression: {
      totalHitDice: 1,
      gainedSkillIds: [],
      gainedPowerIds: [],
      appliedLevels: [1],
      appliedAttributeIncreases: {
        STR: 0,
        DEX: 0,
        CON: 0,
        INT: 0,
        WIS: 0,
        CHA: 0,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("buildRoll20ModPayload", () => {
  it("exports save proficiency flags into attributes", () => {
    const campaign = makeCampaign();
    const gameData: GameData = {
      campaigns: [campaign],
      classes: campaign.classes,
      races: campaign.races ?? [],
      skills: campaign.skills,
      powers: campaign.powers,
      items: campaign.items,
      attackTemplates: campaign.attackTemplates,
    };

    const payload = buildRoll20ModPayload(makeCharacter(), gameData);

    expect(payload.attributes.str_saveprof).toBe("1");
    expect(payload.attributes.wis_saveprof).toBe("1");
    expect(payload.attributes.dex_saveprof).toBe("");
    expect(payload.attributes.con_saveprof).toBe("");
    expect(payload.attributes.int_saveprof).toBe("");
    expect(payload.attributes.cha_saveprof).toBe("");
  });

  it("exports attribute modifiers and derived totals from the same modifier chart", () => {
    const campaign = makeCampaign();
    const gameData: GameData = {
      campaigns: [campaign],
      classes: campaign.classes,
      races: campaign.races ?? [],
      skills: campaign.skills,
      powers: campaign.powers,
      items: campaign.items,
      attackTemplates: campaign.attackTemplates,
    };

    const payload = buildRoll20ModPayload(makeCharacter(), gameData);

    expect(payload.attributes.str_mod).toBe("2");
    expect(payload.attributes.dex_mod).toBe("1");
    expect(payload.attributes.con_mod).toBe("1");
    expect(payload.attributes.int_mod).toBe("0");
    expect(payload.attributes.wis_mod).toBe("2");
    expect(payload.attributes.cha_mod).toBe("-1");

    expect(payload.attributes.ac).toBe("11");
    expect(payload.attributes.initiative).toBe("1");
  });
});
