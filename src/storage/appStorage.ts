import type { CharacterRecord } from "../types/character";
import type { GameData } from "../types/gameData";
import { loadCharacters, saveCharacters } from "./characterStorage";
import { loadGameData, saveGameData } from "./gameDataStorage";

export interface AppStorageAdapter {
  loadCharacters: () => CharacterRecord[];
  saveCharacters: (characters: CharacterRecord[]) => void;
  loadGameData: (fallback: GameData) => GameData;
  saveGameData: (gameData: GameData) => void;
}

export function createLocalStorageAppStorage(): AppStorageAdapter {
  return {
    loadCharacters,
    saveCharacters,
    loadGameData,
    saveGameData,
  };
}

export const appStorage: AppStorageAdapter = createLocalStorageAppStorage();
