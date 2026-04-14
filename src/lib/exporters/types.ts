import type { CharacterRecord } from "../../types/character";
import type { GameData } from "../../types/gameData";

export type ExporterId = "roll20";

export type ExportCommands = {
  phase1: string;
  phase2: string;
  combined: string;
};

export interface CharacterExporter {
  id: ExporterId;
  label: string;
  exportCharacter: (character: CharacterRecord, gameData: GameData) => ExportCommands;
}
