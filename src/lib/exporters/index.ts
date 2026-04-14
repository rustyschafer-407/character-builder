import type { CharacterRecord } from "../../types/character";
import type { GameData } from "../../types/gameData";
import { roll20Exporter } from "./roll20";
import type { CharacterExporter, ExportCommands, ExporterId } from "./types";

export const DEFAULT_EXPORTER_ID: ExporterId = "roll20";

const EXPORTERS: Record<ExporterId, CharacterExporter> = {
  roll20: roll20Exporter,
};

export function getExporter(exporterId: ExporterId): CharacterExporter {
  return EXPORTERS[exporterId];
}

export function exportCharacter(
  character: CharacterRecord,
  gameData: GameData,
  exporterId: ExporterId = DEFAULT_EXPORTER_ID
): ExportCommands {
  return getExporter(exporterId).exportCharacter(character, gameData);
}
