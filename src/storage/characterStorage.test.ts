import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCharacters } from "./characterStorage";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

const STORAGE_KEY = "character-builder.characters";

function makeCharacter() {
  return {
    id: "c-1",
    identity: {
      name: "Test Character",
      playerName: "",
      notes: "",
      ancestry: "",
      background: "",
    },
    campaignId: "fantasy",
    raceId: "human",
    classId: "fighter",
    level: 1,
    proficiencyBonus: 2,
    attributes: {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10,
    },
    attributeGeneration: {
      method: "manual" as const,
      pointBuyTotal: 27,
      rolls: [],
      notes: "",
    },
    hp: {
      max: 10,
      current: 10,
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
        STR: false,
        DEX: false,
        CON: false,
        INT: false,
        WIS: false,
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
    skills: [{ skillId: "acrobatics", attribute: "DEX", proficient: true, bonus: 0, source: "campaign" as const }],
    powers: [{ powerId: "p-1", name: "Second Wind", source: "class" as const }],
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
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("characterStorage.loadCharacters", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    vi.restoreAllMocks();
  });

  it("skips invalid top-level records while keeping valid ones", () => {
    const valid = makeCharacter();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([valid, null, "bad"]));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loaded = loadCharacters();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("c-1");
    expect(warnSpy).toHaveBeenCalledWith(
      "Skipped invalid character records while loading storage",
      { skippedRecords: 2 }
    );
  });

  it("warns when invalid nested skill/power entries are dropped", () => {
    const valid = makeCharacter();
    const withInvalidNested = {
      ...valid,
      skills: [
        ...valid.skills,
        { attribute: "STR", proficient: false, bonus: 0 },
      ],
      powers: [
        ...valid.powers,
        { powerId: "p-2" },
      ],
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify([withInvalidNested]));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const loaded = loadCharacters();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].skills).toHaveLength(1);
    expect(loaded[0].powers).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "Dropped invalid nested character fields while loading storage",
      {
        droppedSkills: 1,
        droppedPowers: 1,
      }
    );
  });
});
