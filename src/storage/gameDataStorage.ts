import type { GameData } from "../types/gameData";

const STORAGE_KEY = "character-builder.gameData";

export function loadGameData(fallback: GameData): GameData {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as GameData;
  } catch (error) {
    console.error("Failed to parse saved game data", error);
    return fallback;
  }
}

export function saveGameData(gameData: GameData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gameData));
}