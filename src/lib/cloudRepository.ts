import type { CharacterRecord } from "../types/character"
import type { CampaignDefinition } from "../types/gameData"
import { getSupabaseClient } from "./supabaseClient"

export type CampaignAccessRole = "player" | "editor"
export type CharacterAccessRole = "viewer" | "editor"

export interface ProfileRow {
  id: string
  email: string | null
  display_name: string | null
  is_admin: boolean
  is_gm: boolean
  created_at: string
  updated_at: string
}

export interface CampaignRow {
  id: string
  slug: string
  name: string
  data: CampaignDefinition
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignAccessRow {
  campaign_id: string
  user_id: string
  role: CampaignAccessRole
  granted_by: string | null
  created_at: string
  updated_at: string
}

export interface AccessibleCampaignRow extends CampaignRow {
  campaign_role: CampaignAccessRole | null
  can_edit: boolean
}

export interface CharacterRow {
  id: string
  campaign_id: string
  name: string
  data: CharacterRecord
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CharacterAccessRow {
  character_id: string
  user_id: string
  role: CharacterAccessRole
  granted_by: string | null
  created_at: string
  updated_at: string
}

export interface AccessibleCharacterRow extends CharacterRow {
  character_role: CharacterAccessRole | null
  can_edit: boolean
}

export interface AccessContext {
  profile: ProfileRow | null
  campaignRolesByCampaignId: Record<string, CampaignAccessRole>
  characterRolesByCharacterId: Record<string, CharacterAccessRole>
}

export async function getCurrentProfile() {
  const supabase = getSupabaseClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, is_admin, is_gm, created_at, updated_at")
    .eq("id", userData.user.id)
    .maybeSingle()

  if (error) throw error
  return (data as ProfileRow | null) ?? null
}

export async function listCampaignAccessRowsForCurrentUser() {
  const supabase = getSupabaseClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) return [] as CampaignAccessRow[]

  const { data, error } = await supabase
    .from("campaign_user_access")
    .select("campaign_id, user_id, role, granted_by, created_at, updated_at")
    .eq("user_id", userData.user.id)

  if (error) throw error
  return (data ?? []) as CampaignAccessRow[]
}

export async function listCharacterAccessRowsForCurrentUser() {
  const supabase = getSupabaseClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) return [] as CharacterAccessRow[]

  const { data, error } = await supabase
    .from("character_user_access")
    .select("character_id, user_id, role, granted_by, created_at, updated_at")
    .eq("user_id", userData.user.id)

  if (error) throw error
  return (data ?? []) as CharacterAccessRow[]
}

export async function getAccessContext() {
  const [profile, campaignAccess, characterAccess] = await Promise.all([
    getCurrentProfile(),
    listCampaignAccessRowsForCurrentUser(),
    listCharacterAccessRowsForCurrentUser(),
  ])

  const campaignRolesByCampaignId = Object.fromEntries(
    campaignAccess.map((row) => [row.campaign_id, row.role] as const)
  )
  const characterRolesByCharacterId = Object.fromEntries(
    characterAccess.map((row) => [row.character_id, row.role] as const)
  )

  return {
    profile,
    campaignRolesByCampaignId,
    characterRolesByCharacterId,
  } as AccessContext
}

export async function listCampaignRows() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, slug, name, data, created_by, created_at, updated_at")
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as CampaignRow[]
}

export async function getCampaignBySlug(slug: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, slug, name, data, created_by, created_at, updated_at")
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
      } as never,
      { onConflict: "slug" }
    )
    .select("id, slug, name, data, created_by, created_at, updated_at")
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
    .select("id, campaign_id, name, data, created_by, created_at, updated_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as CharacterRow[]
}

export async function listAllCharacterRows() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("characters")
    .select("id, campaign_id, name, data, created_by, created_at, updated_at")
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
      } as never,
      { onConflict: "id" }
    )
    .select("id, campaign_id, name, data, created_by, created_at, updated_at")
    .single()

  if (error) throw error
  return data as CharacterRow
}

export async function deleteCharacterRow(characterId: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase.from("characters").delete().eq("id", characterId)
  if (error) throw error
}

export async function listAccessibleCampaignRows() {
  const [campaigns, context] = await Promise.all([
    listCampaignRows(),
    getAccessContext(),
  ])

  return campaigns.map((campaign) => {
    const role = context.profile?.is_admin ? "editor" : context.campaignRolesByCampaignId[campaign.id] ?? null
    const canEdit = Boolean(context.profile?.is_admin || role === "editor")
    return {
      ...campaign,
      campaign_role: role,
      can_edit: canEdit,
    } as AccessibleCampaignRow
  })
}

export async function listEditableCampaignRows() {
  const campaigns = await listAccessibleCampaignRows()
  return campaigns.filter((campaign) => campaign.can_edit)
}

export async function listAccessibleCharacterRows() {
  const [characters, context] = await Promise.all([
    listAllCharacterRows(),
    getAccessContext(),
  ])

  return characters.map((character) => {
    const campaignRole = context.campaignRolesByCampaignId[character.campaign_id]
    const directRole = context.characterRolesByCharacterId[character.id] ?? null
    const createdByCurrentUser = character.created_by === context.profile?.id
    const canEdit = Boolean(
      context.profile?.is_admin ||
        campaignRole === "editor" ||
        directRole === "editor" ||
        createdByCurrentUser
    )
    return {
      ...character,
      character_role: context.profile?.is_admin ? "editor" : directRole,
      can_edit: canEdit,
    } as AccessibleCharacterRow
  })
}

export async function listEditableCharacterRows() {
  const characters = await listAccessibleCharacterRows()
  return characters.filter((character) => character.can_edit)
}

export async function listManageableProfiles() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, is_admin, is_gm, created_at, updated_at")
    .order("email", { ascending: true })

  if (error) throw error
  return (data ?? []) as ProfileRow[]
}

export async function listCampaignAccessRows(campaignRowId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("campaign_user_access")
    .select("campaign_id, user_id, role, granted_by, created_at, updated_at")
    .eq("campaign_id", campaignRowId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as CampaignAccessRow[]
}

export async function upsertCampaignAccessRow(input: {
  campaignRowId: string
  userId: string
  role: CampaignAccessRole
}) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("campaign_user_access")
    .upsert(
      {
        campaign_id: input.campaignRowId,
        user_id: input.userId,
        role: input.role,
      } as never,
      { onConflict: "campaign_id,user_id" }
    )
    .select("campaign_id, user_id, role, granted_by, created_at, updated_at")
    .single()

  if (error) throw error
  return data as CampaignAccessRow
}

export async function deleteCharacterAccessForUserInCampaign(input: {
  campaignRowId: string
  userId: string
}) {
  const characters = await listCharacterRows(input.campaignRowId)
  if (characters.length === 0) return

  const supabase = getSupabaseClient()
  for (const character of characters) {
    const { error } = await supabase
      .from("character_user_access")
      .delete()
      .eq("character_id", character.id)
      .eq("user_id", input.userId)
    if (error) throw error
  }
}

export async function deleteCampaignAccessRow(input: {
  campaignRowId: string
  userId: string
  isAdmin: boolean
}) {
  const accessRows = await listCampaignAccessRows(input.campaignRowId)
  const target = accessRows.find((row) => row.user_id === input.userId) ?? null

  if (!target) {
    return
  }

  if (target.role === "editor" && !input.isAdmin) {
    const editorCount = accessRows.filter((row) => row.role === "editor").length
    if (editorCount <= 1) {
      throw new Error("Cannot remove the last campaign editor unless you are an admin")
    }
  }

  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("campaign_user_access")
    .delete()
    .eq("campaign_id", input.campaignRowId)
    .eq("user_id", input.userId)

  if (error) throw error

  await deleteCharacterAccessForUserInCampaign({
    campaignRowId: input.campaignRowId,
    userId: input.userId,
  })
}

export async function listCharacterAccessRows(characterId: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("character_user_access")
    .select("character_id, user_id, role, granted_by, created_at, updated_at")
    .eq("character_id", characterId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []) as CharacterAccessRow[]
}

export async function upsertCharacterAccessRow(input: {
  characterId: string
  userId: string
  role: CharacterAccessRole
}) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from("character_user_access")
    .upsert(
      {
        character_id: input.characterId,
        user_id: input.userId,
        role: input.role,
      } as never,
      { onConflict: "character_id,user_id" }
    )
    .select("character_id, user_id, role, granted_by, created_at, updated_at")
    .single()

  if (error) throw error
  return data as CharacterAccessRow
}

export async function deleteCharacterAccessRow(input: {
  characterId: string
  userId: string
}) {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from("character_user_access")
    .delete()
    .eq("character_id", input.characterId)
    .eq("user_id", input.userId)

  if (error) throw error
}
