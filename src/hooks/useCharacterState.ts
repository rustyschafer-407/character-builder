import { useState } from "react";
import { generateId, touchCharacter } from "../lib/character";
import type { CharacterCreationDraft } from "../components/CharacterCreationWizard";
import type { CharacterRecord } from "../types/character";
import type { Dispatch, SetStateAction } from "react";

interface CommitCreatedCharacterParams {
  draft: CharacterCreationDraft;
  setCharacters: Dispatch<SetStateAction<CharacterRecord[]>>;
  onPersistUpsert: (character: CharacterRecord) => Promise<void>;
}

interface UpdateCharacterParams {
  updated: CharacterRecord;
  setCharacters: Dispatch<SetStateAction<CharacterRecord[]>>;
  onPersistUpsert: (character: CharacterRecord) => Promise<void>;
}

export function useCharacterState() {
  const [selectedCharacterId, setSelectedCharacterId] = useState("");

  function commitCreatedCharacter(input: CommitCreatedCharacterParams) {
    const { draft, setCharacters, onPersistUpsert } = input;
    const character: CharacterRecord = {
      id: generateId(),
      identity: draft.identity,
      campaignId: draft.campaignId,
      raceId: draft.raceId,
      classId: draft.classId,
      level: draft.level,
      proficiencyBonus: draft.proficiencyBonus,
      attributes: draft.attributes,
      attributeGeneration: draft.attributeGeneration,
      hp: draft.hp,
      sheet: {
        speed: "",
        acBase: 10,
        acBonus: 0,
        acUseDex: true,
        initMisc: 0,
        saveProf: { ...draft.saveProf },
        saveBonus: {
          STR: 0,
          DEX: 0,
          CON: 0,
          INT: 0,
          WIS: 0,
          CHA: 0,
        },
      },
      skills: draft.skills,
      powers: draft.powers,
      inventory: draft.inventory,
      attacks: draft.attacks,
      levelProgression: draft.levelProgression,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCharacters((previous) => [...previous, character]);
    setSelectedCharacterId(character.id);
    void onPersistUpsert(character);
  }

  function updateCharacter(input: UpdateCharacterParams) {
    const { updated, setCharacters, onPersistUpsert } = input;
    const touched = touchCharacter(updated);
    setCharacters((previous) =>
      previous.map((character) => (character.id === touched.id ? touched : character))
    );
    void onPersistUpsert(touched);
  }

  return {
    selectedCharacterId,
    setSelectedCharacterId,
    commitCreatedCharacter,
    updateCharacter,
  };
}
