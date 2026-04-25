import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createGameData, gameData as seedGameData } from "../data/gameData";
import { buildCloudHydratedState } from "../lib/cloudHydration";
import {
  claimCampaignEmailAccessInvites,
  deleteCharacterRow,
  ensureProfileExists,
  listAccessibleCampaignRows,
  listAccessibleCharacterRows,
  upsertCampaignBySlug,
  upsertCharacterRow,
} from "../lib/cloudRepository";
import type { CharacterRecord } from "../types/character";
import type { GameData } from "../types/gameData";

interface UseCloudSyncParams {
  cloudEnabled: boolean;
  currentUserId: string | null;
  setIsAdmin: (value: boolean) => void;
  setIsGm: (value: boolean) => void;
  setCampaignRolesByCampaignId: (value: Record<string, "player" | "editor">) => void;
  setCharacterRolesByCharacterId: (value: Record<string, "viewer" | "editor">) => void;
  setCampaignId: Dispatch<SetStateAction<string>>;
  setSelectedId: Dispatch<SetStateAction<string>>;
}

export function useCloudSync({
  cloudEnabled,
  currentUserId,
  setIsAdmin,
  setIsGm,
  setCampaignRolesByCampaignId,
  setCharacterRolesByCharacterId,
  setCampaignId,
  setSelectedId,
}: UseCloudSyncParams) {
  const isDevelopment = import.meta.env.DEV;
  const initialCloudGameData = useMemo(() => createGameData({ campaigns: [] }), []);

  const [gameData, setGameData] = useState<GameData>(() =>
    cloudEnabled ? initialCloudGameData : seedGameData
  );
  const [characters, setCharacters] = useState<CharacterRecord[]>([]);
  const [characterCanEditByCharacterId, setCharacterCanEditByCharacterId] = useState<Record<string, boolean>>({});
  const [campaignRowIdsByAppId, setCampaignRowIdsByAppId] = useState<Record<string, string>>({});
  const [campaignCreatedByByCampaignId, setCampaignCreatedByByCampaignId] = useState<Record<string, string | null>>({});
  const [cloudStatus, setCloudStatus] = useState(
    cloudEnabled ? "Connecting to cloud..." : "Supabase configuration missing"
  );
  const [cloudLoadComplete, setCloudLoadComplete] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState("");

  async function safeUpsert<T>(entity: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : `${entity} save failed`;
      setCloudError(message);
      setCloudStatus(`${entity} save failed (see console)`);
      throw error;
    }
  }

  function warnPotentialDestructiveSync(params: {
    entity: string;
    previousCount: number;
    nextCount: number;
  }) {
    if (!isDevelopment) return;

    const syncingEmptyDataset = params.nextCount === 0;
    const significantlyReduced = params.previousCount > 0 && params.nextCount < params.previousCount * 0.5;

    if (syncingEmptyDataset || significantlyReduced) {
      console.warn("WARNING: Potential destructive sync prevented", params);
    }
  }

  useEffect(() => {
    if (!cloudEnabled) {
      setCloudStatus("Supabase configuration missing");
      setCloudLoading(false);
      setCloudError("");
      return;
    }

    setCloudLoadComplete(false);

    if (!currentUserId) {
      setCampaignRowIdsByAppId({});
      setCampaignCreatedByByCampaignId({});
      setCharacterCanEditByCharacterId({});
      setGameData(initialCloudGameData);
      setCharacters([]);
      setCampaignId("");
      setSelectedId("");
      setCloudStatus("Connecting to cloud...");
      setCloudError("");
      setCloudLoading(false);
      return;
    }
  }, [cloudEnabled, currentUserId, initialCloudGameData, setCampaignId, setSelectedId]);

  useEffect(() => {
    if (!cloudEnabled || !currentUserId || cloudLoadComplete) return;

    let isCancelled = false;

    async function initializeCloud() {
      setCloudLoading(true);
      setCloudError("");

      try {
        setCloudStatus("Loading campaigns and characters...");

        const profile = await ensureProfileExists();
        try {
          await claimCampaignEmailAccessInvites();
        } catch {
          // Invite claiming is best-effort so initial hydration can continue.
        }

        setIsAdmin(Boolean(profile?.is_admin));
        setIsGm(Boolean(profile?.is_gm));

        const [campaignRows, characterRows] = await Promise.all([
          listAccessibleCampaignRows(),
          listAccessibleCharacterRows(),
        ]);

        if (isCancelled) return;

        const hydrated = buildCloudHydratedState({ campaignRows, characterRows });

        setCampaignRowIdsByAppId(hydrated.campaignRowIdsByAppId);
        setCampaignCreatedByByCampaignId(hydrated.campaignCreatedByByCampaignId);
        setCampaignRolesByCampaignId(hydrated.campaignRolesByCampaignId);
        setCharacterRolesByCharacterId(hydrated.characterRolesByCharacterId);
        setCharacterCanEditByCharacterId(hydrated.characterCanEditByCharacterId);
        setGameData(hydrated.gameData);
        setCharacters(hydrated.characters);
        setCampaignId((current) =>
          hydrated.gameData.campaigns.some((campaign) => campaign.id === current)
            ? current
            : hydrated.gameData.campaigns[0]?.id ?? ""
        );
        setSelectedId((current) =>
          hydrated.characters.some((character) => character.id === current) ? current : ""
        );

        setCloudStatus("Authenticated cloud access active");
      } catch (error) {
        console.error("Failed to initialize cloud sync", error);
        if (!isCancelled) {
          const message = error instanceof Error ? error.message : "Cloud unavailable";
          setCloudError(message);
          setCloudStatus("Cloud unavailable");
        }
      } finally {
        if (!isCancelled) {
          setCloudLoadComplete(true);
          setCloudLoading(false);
        }
      }
    }

    void initializeCloud();

    return () => {
      isCancelled = true;
    };
  }, [
    cloudEnabled,
    currentUserId,
    cloudLoadComplete,
    setCampaignId,
    setSelectedId,
    setCampaignRolesByCampaignId,
    setCharacterRolesByCharacterId,
    setIsAdmin,
    setIsGm,
  ]);

  const persistCampaignChanges = useCallback(
    async (previousGameData: GameData, nextGameData: GameData) => {
      if (!cloudEnabled || !currentUserId) return;
      // Do not apply client-side role checks here; Supabase RLS is the enforcement boundary.
      // Do NOT delete remote data based on local state.

      warnPotentialDestructiveSync({
        entity: "campaigns",
        previousCount: previousGameData.campaigns.length,
        nextCount: nextGameData.campaigns.length,
      });

      try {
        const nextCampaignMap = { ...campaignRowIdsByAppId };

        for (const campaign of nextGameData.campaigns) {
          const previous = gameData.campaigns.find((item) => item.id === campaign.id);
          const isChanged = !previous || JSON.stringify(previous) !== JSON.stringify(campaign);
          if (!isChanged) {
            continue;
          }

          const row = await safeUpsert("Campaign", async () =>
            upsertCampaignBySlug({
              slug: campaign.id,
              name: campaign.name,
              campaign,
            })
          );
          nextCampaignMap[campaign.id] = row.id;
        }

        setCampaignRowIdsByAppId(nextCampaignMap);
        setCloudStatus("Authenticated cloud access active");
        setCloudError("");
      } catch (error) {
        console.error("Failed to persist campaign changes", error);
        const message = error instanceof Error ? error.message : "Campaign save failed";
        setCloudError(message);
        setCloudStatus("Campaign save failed (see console)");
      }
    },
    [campaignRowIdsByAppId, cloudEnabled, currentUserId, gameData.campaigns, isDevelopment]
  );

  const persistCharacterUpsert = useCallback(
    async (character: CharacterRecord) => {
      if (!cloudEnabled || !currentUserId) return;
      // Do not apply client-side role checks here; Supabase RLS is the enforcement boundary.
      // Do NOT delete remote data based on local state.

      const campaignRowId = campaignRowIdsByAppId[character.campaignId];
      if (!campaignRowId) {
        setCloudStatus("Character save blocked: campaign not yet persisted");
        return;
      }

      try {
        await safeUpsert("Character", async () =>
          upsertCharacterRow({
            campaignId: campaignRowId,
            character,
          })
        );
        // Backend RLS already determines editability; for new creator-owned
        // characters, ensure UI permissions reflect edit access immediately.
        setCharacterCanEditByCharacterId((previous) => ({
          ...previous,
          [character.id]: true,
        }));
        setCloudStatus("Authenticated cloud access active");
        setCloudError("");
      } catch (error) {
        console.error("Failed to persist character", error);
        const message = error instanceof Error ? error.message : "Character save failed";
        setCloudError(message);
        setCloudStatus("Character save failed (see console)");
      }
    },
    [campaignRowIdsByAppId, cloudEnabled, currentUserId]
  );

  const persistCharacterDelete = useCallback(
    async (characterId: string) => {
      if (!cloudEnabled || !currentUserId) return;
      // Do not apply client-side role checks here; Supabase RLS is the enforcement boundary.
      // Do NOT delete remote data based on local state.
      // TODO: Future explicit delete flow (user-confirmed, ownership-checked).

      try {
        await deleteCharacterRow(characterId);
        setCharacterCanEditByCharacterId((previous) => {
          const next = { ...previous };
          delete next[characterId];
          return next;
        });
        setCloudStatus("Authenticated cloud access active");
        setCloudError("");
      } catch (error) {
        console.error("Failed to delete character", error);
        const message = error instanceof Error ? error.message : "Character delete failed";
        setCloudError(message);
        setCloudStatus("Character delete failed (see console)");
      }
    },
    [cloudEnabled, currentUserId]
  );

  return {
    gameData,
    setGameData,
    characters,
    setCharacters,
    characterCanEditByCharacterId,
    campaignRowIdsByAppId,
    campaignCreatedByByCampaignId,
    cloudStatus,
    setCloudStatus,
    cloudLoadComplete,
    cloudLoading,
    cloudError,
    persistCampaignChanges,
    persistCharacterUpsert,
    persistCharacterDelete,
  };
}
