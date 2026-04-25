import { createGameData } from "../data/gameData"
import type { CharacterRecord } from "../types/character"
import type { CampaignDefinition, GameData } from "../types/gameData"
import type { AccessibleCampaignRow, AccessibleCharacterRow } from "./cloudRepository"
import { applySafeCharacterDefaults } from "./domain"

export function makeDefaultSheet(): CharacterRecord["sheet"] {
  return {
    speed: "",
    acBase: 10,
    acBonus: 0,
    acUseDex: true,
    initMisc: 0,
    saveProf: {
      STR: false,
      DEX: false,
      CON: false,
      INT: false,
      WIS: false,
      CHA: false,
    },
    saveBonus: {
      STR: 0,
      DEX: 0,
      CON: 0,
      INT: 0,
      WIS: 0,
      CHA: 0,
    },
  }
}

export function resolveCloudCampaignId(row: {
  slug: string
  data: Partial<CampaignDefinition> | null | undefined
}) {
  const slug = typeof row.slug === "string" ? row.slug.trim() : ""
  if (slug) {
    return slug
  }

  const dataId =
    row.data && typeof row.data.id === "string" ? row.data.id.trim() : ""
  return dataId
}

export function normalizeCloudCampaignRow(row: {
  slug: string
  name: string
  data: CampaignDefinition
}) {
  if (!row.data || typeof row.data !== "object") {
    return null
  }

  const campaignId = resolveCloudCampaignId(row)
  if (!campaignId) {
    return null
  }

  const normalizedName =
    typeof row.data.name === "string" && row.data.name.trim().length > 0
      ? row.data.name
      : row.name || campaignId

  return {
    ...row.data,
    id: campaignId,
    name: normalizedName,
  } as CampaignDefinition
}

export function buildCloudHydratedState(input: {
  campaignRows: AccessibleCampaignRow[]
  characterRows: AccessibleCharacterRow[]
}) {
  const normalizedCloudCampaigns = input.campaignRows
    .map((row) => normalizeCloudCampaignRow(row))
    .filter((row): row is CampaignDefinition => row !== null)

  const gameData: GameData = createGameData({ campaigns: normalizedCloudCampaigns })

  const campaignRowIdsByAppId = Object.fromEntries(
    input.campaignRows
      .map((row) => [resolveCloudCampaignId(row), row.id] as const)
      .filter(([id]) => Boolean(id))
  )

  const campaignRolesByCampaignId = Object.fromEntries(
    input.campaignRows
      .filter((row) => row.campaign_role)
      .map((row) => [resolveCloudCampaignId(row), row.campaign_role] as const)
  ) as Record<string, "player" | "editor">

  const campaignCreatedByByCampaignId = Object.fromEntries(
    input.campaignRows
      .map((row) => [resolveCloudCampaignId(row), row.created_by ?? null] as const)
      .filter(([id]) => Boolean(id))
  ) as Record<string, string | null>

  const characterRolesByCharacterId = Object.fromEntries(
    input.characterRows
      .filter((row) => row.character_role)
      .map((row) => [row.id, row.character_role] as const)
  ) as Record<string, "viewer" | "editor">

  const accessibleCampaignIds = new Set(gameData.campaigns.map((campaign) => campaign.id))

  const characters = input.characterRows
    .map((row) => row.data)
    .filter((character) => accessibleCampaignIds.has(character.campaignId))
    .map((character) =>
      applySafeCharacterDefaults(
        character.sheet
          ? character
          : {
              ...character,
              sheet: makeDefaultSheet(),
            }
      )
    )

  return {
    gameData,
    characters,
    campaignRowIdsByAppId,
    campaignRolesByCampaignId,
    campaignCreatedByByCampaignId,
    characterRolesByCharacterId,
  }
}
