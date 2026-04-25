import { useState } from "react";
import { getClassesForCampaign } from "../lib/character";
import {
  getFirstVisibleCharacterId,
  makeBlankCampaign,
  resolveActiveCampaignId,
} from "../lib/campaigns";
import type { CharacterRecord } from "../types/character";
import type { GameData } from "../types/gameData";

interface UseCampaignAdminSessionParams {
  gameData: GameData;
  campaignId: string;
  selectedId: string;
  characters: CharacterRecord[];
  setGameData: (value: GameData) => void;
  setCampaignId: (value: string) => void;
  setClassId: (value: string) => void;
  setSelectedId: (value: string) => void;
}

function deriveCampaignSyncState(
  nextGameData: GameData,
  preferredCampaignId: string,
  characters: CharacterRecord[],
  selectedId: string
) {
  const nextCampaignId = resolveActiveCampaignId(nextGameData, preferredCampaignId);
  const nextClassId = getClassesForCampaign(nextGameData, nextCampaignId)[0]?.id ?? "";
  if (!selectedId) {
    return {
      nextCampaignId,
      nextClassId,
      nextSelectedId: "",
    };
  }

  const selectedCharacter = characters.find((character) => character.id === selectedId) ?? null;
  const nextSelectedId =
    !selectedCharacter || selectedCharacter.campaignId !== nextCampaignId
      ? getFirstVisibleCharacterId(characters, nextCampaignId)
      : selectedId;

  return {
    nextCampaignId,
    nextClassId,
    nextSelectedId,
  };
}

export function useCampaignAdminSession({
  gameData,
  campaignId,
  selectedId,
  characters,
  setGameData,
  setCampaignId,
  setClassId,
  setSelectedId,
}: UseCampaignAdminSessionParams) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAutoFocusCampaignName, setAdminAutoFocusCampaignName] = useState(false);
  const [adminSaveRequestVersion, setAdminSaveRequestVersion] = useState(0);

  function openAdminForCurrentCampaign() {
    setAdminAutoFocusCampaignName(false);
    setAdminOpen(true);
  }

  function createCampaignAndOpenAdmin() {
    const newCampaign = makeBlankCampaign();
    const nextGameData: GameData = {
      ...gameData,
      campaigns: [...gameData.campaigns, newCampaign],
    };

    setGameData(nextGameData);
    setCampaignId(newCampaign.id);
    setClassId("");
    setSelectedId(getFirstVisibleCharacterId(characters, newCampaign.id));
    setAdminAutoFocusCampaignName(true);
    setAdminOpen(true);
    return newCampaign.id;
  }

  function cancelAdmin() {
    setAdminOpen(false);
    setAdminAutoFocusCampaignName(false);
  }

  function requestAdminSave() {
    setAdminSaveRequestVersion((value) => value + 1);
  }

  function handleAdminSave(nextGameData: GameData) {
    const sync = deriveCampaignSyncState(nextGameData, campaignId, characters, selectedId);

    setGameData(nextGameData);
    setCampaignId(sync.nextCampaignId);
    setClassId(sync.nextClassId);
    setSelectedId(sync.nextSelectedId);

    setAdminOpen(false);
    setAdminAutoFocusCampaignName(false);
  }

  function handleAdminGameDataChange(nextGameData: GameData) {
    const sync = deriveCampaignSyncState(nextGameData, campaignId, characters, selectedId);

    setGameData(nextGameData);
    setCampaignId(sync.nextCampaignId);
    setClassId(sync.nextClassId);
    setSelectedId(sync.nextSelectedId);
  }

  return {
    adminOpen,
    adminAutoFocusCampaignName,
    adminSaveRequestVersion,
    openAdminForCurrentCampaign,
    createCampaignAndOpenAdmin,
    cancelAdmin,
    requestAdminSave,
    handleAdminSave,
    handleAdminGameDataChange,
  };
}
