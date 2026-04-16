import type { CharacterExporter } from "./types";
import { buildRoll20ModImportCommand } from "../roll20Export";

export const roll20Exporter: CharacterExporter = {
  id: "roll20",
  label: "Roll20 (Mod Import)",
  exportCharacter: (character, gameData) => ({
    modPayload: buildRoll20ModImportCommand(character, gameData),
  }),
};
