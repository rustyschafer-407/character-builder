import type { GameData } from "../types/gameData";

export const gameData: GameData = {
  genres: [
    {
      id: "fantasy",
      name: "Fantasy",
      labels: {
        attributes: "Attributes",
        skills: "Skills",
        attacks: "Weapons",
        powers: "Spells",
        inventory: "Gear",
        className: "Class",
        level: "Level",
        hp: "HP",
      },
      availableClassIds: ["fighter", "wizard"],
      availableSkillIds: [
        "athletics",
        "acrobatics",
        "stealth",
        "lore",
        "investigation",
        "perception",
        "survival",
        "presence",
      ],
      availablePowerIds: ["fireball", "heal"],
      availableItemIds: ["rope", "torch"],
      availableAttackTemplateIds: ["sword", "bow"],
      attributeRules: {
        generationMethods: ["pointBuy", "randomRoll"],
        pointBuyTotal: 27,
      },
    },
    {
      id: "scifi",
      name: "Sci-Fi",
      labels: {
        attributes: "Stats",
        skills: "Disciplines",
        attacks: "Weapons",
        powers: "Abilities",
        inventory: "Equipment",
        className: "Role",
        level: "Rank",
        hp: "Vitality",
      },
      availableClassIds: ["soldier", "engineer"],
      availableSkillIds: [
        "piloting",
        "engineering",
        "hacking",
        "perception",
        "survival",
        "command",
        "intimidation",
      ],
      availablePowerIds: ["overcharge", "shield"],
      availableItemIds: ["medkit", "scanner"],
      availableAttackTemplateIds: ["blaster", "laser_rifle"],
      attributeRules: {
        generationMethods: ["pointBuy"],
        pointBuyTotal: 30,
      },
    },
  ],

  classes: [
    {
      id: "fighter",
      genreId: "fantasy",
      name: "Fighter",
      attributeBonuses: [{ attribute: "STR", amount: 2 }],
      hpRule: {
        hitDie: 10,
        level1Mode: "fixed-max",
        levelUpMode: "fixed-average",
        levelUpFixedValue: 6,
      },
      startingAttackTemplateIds: ["sword"],
      skillChoiceRules: [
        { choose: 2, skillIds: ["athletics", "survival", "perception"] },
      ],
    },
    {
      id: "wizard",
      genreId: "fantasy",
      name: "Wizard",
      attributeBonuses: [{ attribute: "INT", amount: 2 }],
      hpRule: {
        hitDie: 6,
        level1Mode: "fixed-max",
        levelUpMode: "fixed-average",
        levelUpFixedValue: 4,
      },
      defaultPowerIds: ["fireball"],
      skillChoiceRules: [
        { choose: 2, skillIds: ["lore", "investigation", "perception"] },
      ],
    },
    {
      id: "soldier",
      genreId: "scifi",
      name: "Soldier",
      attributeBonuses: [{ attribute: "STR", amount: 1 }],
      hpRule: {
        hitDie: 10,
        level1Mode: "fixed-max",
        levelUpMode: "fixed-average",
        levelUpFixedValue: 6,
      },
      startingAttackTemplateIds: ["blaster"],
      skillChoiceRules: [
        { choose: 2, skillIds: ["command", "intimidation", "survival"] },
      ],
    },
    {
      id: "engineer",
      genreId: "scifi",
      name: "Engineer",
      attributeBonuses: [{ attribute: "INT", amount: 2 }],
      hpRule: {
        hitDie: 6,
        level1Mode: "fixed-max",
        levelUpMode: "fixed-average",
        levelUpFixedValue: 4,
      },
      defaultPowerIds: ["shield"],
      skillChoiceRules: [
        { choose: 2, skillIds: ["engineering", "hacking", "perception"] },
      ],
    },
  ],

  skills: [
    { id: "athletics", name: "Athletics", attribute: "STR" },
    { id: "acrobatics", name: "Acrobatics", attribute: "DEX" },
    { id: "stealth", name: "Stealth", attribute: "DEX" },
    { id: "lore", name: "Lore", attribute: "INT" },
    { id: "investigation", name: "Investigation", attribute: "INT" },
    { id: "perception", name: "Perception", attribute: "WIS" },
    { id: "survival", name: "Survival", attribute: "WIS" },
    { id: "presence", name: "Presence", attribute: "CHA" },
    { id: "piloting", name: "Piloting", attribute: "DEX" },
    { id: "engineering", name: "Engineering", attribute: "INT" },
    { id: "hacking", name: "Hacking", attribute: "INT" },
    { id: "command", name: "Command", attribute: "CHA" },
    { id: "intimidation", name: "Intimidation", attribute: "CHA" },
  ],

  powers: [
    { id: "fireball", name: "Fireball" },
    { id: "heal", name: "Heal" },
    { id: "overcharge", name: "Overcharge" },
    { id: "shield", name: "Shield" },
  ],

  items: [
    { id: "rope", name: "Rope", stackable: false },
    { id: "torch", name: "Torch", stackable: true, defaultQuantity: 3 },
    { id: "medkit", name: "Medkit", stackable: false },
    { id: "scanner", name: "Scanner", stackable: false },
  ],

  attackTemplates: [
    {
      id: "sword",
      name: "Sword",
      attribute: "STR",
      damage: "1d8",
    },
    {
      id: "bow",
      name: "Bow",
      attribute: "DEX",
      damage: "1d6",
    },
    {
      id: "blaster",
      name: "Blaster",
      attribute: "DEX",
      damage: "1d8",
    },
    {
      id: "laser_rifle",
      name: "Laser Rifle",
      attribute: "DEX",
      damage: "1d10",
    },
  ],
};