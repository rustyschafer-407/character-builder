import { useState } from "react";
import { getClassesForCampaignAndRace, getRacesForCampaign } from "../lib/character";
import { getFirstVisibleCharacterId } from "../lib/campaigns";
import type { CharacterRecord } from "../types/character";
import type { GameData } from "../types/gameData";
import type { Dispatch, SetStateAction } from "react";

interface UseCampaignStateParams {
  cloudEnabled: boolean;
  initialCampaignId: string;
}

interface HandleCampaignChangeParams {
  nextCampaignId: string;
  gameData: GameData;
  characters: CharacterRecord[];
  selectedCharacterId: string;
  setSelectedCharacterId: Dispatch<SetStateAction<string>>;
  setRaceId: Dispatch<SetStateAction<string>>;
  setClassId: Dispatch<SetStateAction<string>>;
}

export function useCampaignState({
  cloudEnabled,
  initialCampaignId,
}: UseCampaignStateParams) {
  const [selectedCampaignId, setSelectedCampaignId] = useState(() =>
    cloudEnabled ? "" : initialCampaignId
  );

  function handleCampaignChange(params: HandleCampaignChangeParams) {
    const {
      nextCampaignId,
      gameData,
      characters,
      selectedCharacterId,
      setSelectedCharacterId,
      setRaceId,
      setClassId,
    } = params;

    setSelectedCampaignId(nextCampaignId);

    const nextRaceId = getRacesForCampaign(gameData, nextCampaignId)[0]?.id ?? "";
    setRaceId(nextRaceId);

    const nextClassId = getClassesForCampaignAndRace(gameData, nextCampaignId, nextRaceId)[0]?.id ?? "";
    setClassId(nextClassId);

    const currentlyVisible = characters.some(
      (character) =>
        character.id === selectedCharacterId && character.campaignId === nextCampaignId
    );

    if (selectedCharacterId && !currentlyVisible) {
      setSelectedCharacterId(getFirstVisibleCharacterId(characters, nextCampaignId));
    }
  }

  return {
    selectedCampaignId,
    setSelectedCampaignId,
    handleCampaignChange,
  };
}
