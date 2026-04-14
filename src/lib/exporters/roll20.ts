import type { CharacterExporter } from "./types";
import { buildChatSetAttrPhases } from "../roll20Export";

export const roll20Exporter: CharacterExporter = {
  id: "roll20",
  label: "Roll20 (ChatSetAttr)",
  exportCharacter: (character, gameData) => buildChatSetAttrPhases(character, gameData),
};
