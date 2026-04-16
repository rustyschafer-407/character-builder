import type { CharacterRecord } from "../../types/character";
import type { GameData } from "../../types/gameData";

export type ExporterId = "roll20";

export type ExportCommands = {
  modPayload: string;
};

export interface CharacterExporter {
  id: ExporterId;
  label: string;
  exportCharacter: (character: CharacterRecord, gameData: GameData) => ExportCommands;
}
