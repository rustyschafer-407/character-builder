import type { CampaignDefinition, GameData } from "../types/gameData";
import { createGameData } from "../data/gameData";

const STORAGE_KEY = "character-builder.gameData";

export function loadGameData(fallback: GameData): GameData {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return fallback;

  try {
    const parsedValue = JSON.parse(raw);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return fallback;
    }

    const parsedObject = parsedValue as { campaigns?: unknown };
    if (!Array.isArray(parsedObject.campaigns)) {
      return fallback;
    }

    return createGameData({ campaigns: parsedObject.campaigns as CampaignDefinition[] });
  } catch (error) {
    console.error("Failed to parse saved game data", error);
    return fallback;
  }
}

export function saveGameData(gameData: GameData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
}