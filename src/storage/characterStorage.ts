import type { CharacterRecord } from "../types/character";

const STORAGE_KEY = "character-builder.characters";

export function loadCharacters(): CharacterRecord[] {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) return [];

  try {
    return JSON.parse(raw) as CharacterRecord[];
  } catch (error) {
    console.error("Failed to parse saved characters", error);
    return [];
  }
}

export function saveCharacters(characters: CharacterRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(characters));
}