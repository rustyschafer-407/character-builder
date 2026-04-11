import type { CharacterRecord } from "../types/character"
import type { CampaignDefinition } from "../types/gameData"
import { getSupabaseClient } from "./supabaseClient"

export interface CampaignRow {
  id: string
  slug: string
  name: string
  data: CampaignDefinition
  created_at: string
  updated_at: string
}

export interface CharacterRow {
  id: string
  campaign_id: string
  name: string
  data: CharacterRecord
  created_at: string
  updated_at: string
}

export async function listCampaignRows() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, slug, name, data, created_at, updated_at")
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as CampaignRow[]
}

export async function getCampaignBySlug(slug: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, slug, name, data, created_at, updated_at")
    .eq("slug", slug)
    .maybeSingle()

  if (error) throw error
  return (data as CampaignRow | null) ?? null
}

export async function upsertCampaignBySlug(input: {
  slug: string
  name: string
  campaign: CampaignDefinition
}) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("campaigns")
    .upsert(
      {
        slug: input.slug,
        name: input.name,
        data: input.campaign,
      },
      { onConflict: "slug" }
    )
    .select("id, slug, name, data, created_at, updated_at")
    .single()

  if (error) throw error
  return data as CampaignRow
}

export async function deleteCampaignById(campaignId: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId)
  if (error) throw error
}

export async function listCharacterRows(campaignId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("characters")
    .select("id, campaign_id, name, data, created_at, updated_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as CharacterRow[]
}

export async function listAllCharacterRows() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("characters")
    .select("id, campaign_id, name, data, created_at, updated_at")
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as CharacterRow[]
}

export async function upsertCharacterRow(input: {
  campaignId: string
  character: CharacterRecord
}) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("characters")
    .upsert(
      {
        id: input.character.id,
        campaign_id: input.campaignId,
        name: input.character.identity.name,
        data: input.character,
      },
      { onConflict: "id" }
    )
    .select("id, campaign_id, name, data, created_at, updated_at")
    .single()

  if (error) throw error
  return data as CharacterRow
}

export async function deleteCharacterRow(characterId: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("characters").delete().eq("id", characterId)
  if (error) throw error
}
