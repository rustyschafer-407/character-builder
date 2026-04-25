/**
 * Centralized permission model for Character Builder.
 * Single source of truth for all authorization logic.
 * 
 * Global roles: Admin, GM, Player
 * Campaign access: GM (editor) or Player (player)
 * Character access: Editor or Viewer
 * 
 * Enforce permissions:
 * 1. In this module via pure functions
 * 2. In Supabase RLS policies (enforced server-side)
 * 3. Hide UI affordances based on these checks
 */

import type { ProfileRow, CampaignAccessRole, CharacterAccessRole } from "./cloudRepository";

export interface AuthState {
  profile: ProfileRow | null;
  campaignRolesByCampaignId: Record<string, CampaignAccessRole>;
  characterRolesByCharacterId: Record<string, CharacterAccessRole>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// User role helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function isAdmin(profile: ProfileRow | null): boolean {
  return profile?.is_admin ?? false;
}

export function isGm(profile: ProfileRow | null): boolean {
  return profile?.is_gm ?? false;
}

export function isPlayer(profile: ProfileRow | null): boolean {
  return profile !== null && !profile.is_admin && !profile.is_gm;
}

/**
 * Get effective roles for this user, in priority order for hint visibility.
 * Admins have all capabilities; GMs have campaign-based capabilities; Players are restricted.
 */
export function getEffectiveRoles(auth: AuthState): ("admin" | "gm" | "player")[] {
  if (!auth.profile) return [];
  const roles: ("admin" | "gm" | "player")[] = [];
  if (isAdmin(auth.profile)) roles.push("admin");
  if (isGm(auth.profile)) roles.push("gm");
  if (isPlayer(auth.profile) || Object.keys(auth.campaignRolesByCampaignId).length > 0) {
    roles.push("player");
  }
  return roles;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// User management capabilities (Admin only)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function canManageUsers(auth: AuthState): boolean {
  return isAdmin(auth.profile);
}

export function canCreateUser(auth: AuthState): boolean {
  return isAdmin(auth.profile);
}

export function canSetUserEmail(auth: AuthState): boolean {
  return isAdmin(auth.profile);
}

export function canSetUserPassword(auth: AuthState): boolean {
  return isAdmin(auth.profile);
}

export function canSetUserRoles(auth: AuthState): boolean {
  return isAdmin(auth.profile);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Campaign capabilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Can user create a new campaign?
 * Admins and GMs can create campaigns.
 */
export function canCreateCampaign(auth: AuthState): boolean {
  return isAdmin(auth.profile) || isGm(auth.profile);
}

/**
 * Can user see/enter a campaign?
 * Admin: all campaigns
 * GM: campaigns they're assigned to (or created, which auto-assigns them)
 * Player: campaigns they're assigned to
 */
export function canViewCampaign(auth: AuthState, campaignId: string): boolean {
  if (!auth.profile) return false;
  if (isAdmin(auth.profile)) return true;
  return auth.campaignRolesByCampaignId[campaignId] !== undefined;
}

/**
 * Can user edit/configure a campaign?
 * Admin: all campaigns
 * GM: campaigns where they have 'editor' role (campaign setup, settings, access)
 * Player: never
 */
export function canEditCampaign(auth: AuthState, campaignId: string): boolean {
  if (!auth.profile) return false;
  if (isAdmin(auth.profile)) return true;
  return auth.campaignRolesByCampaignId[campaignId] === "editor";
}

/**
 * Can user manage campaign access (add/remove/modify campaign member roles)?
 * Admin: all campaigns
 * GM: campaigns they can edit
 * Player: never
 */
export function canManageCampaignAccess(auth: AuthState, campaignId: string): boolean {
  return canEditCampaign(auth, campaignId);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Character capabilities
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Can user create a new character in a campaign?
 * Admin: creates PC or NPC anywhere
 * GM: creates PC or NPC in campaigns they have access to
 * Player: creates PC only in campaigns they have access to; never NPCs
 */
export function canCreateCharacter(
  auth: AuthState,
  campaignId: string,
  characterType: "pc" | "npc"
): boolean {
  if (!auth.profile) return false;

  // Must have view access to the campaign
  if (!canViewCampaign(auth, campaignId)) return false;

  if (isAdmin(auth.profile)) return true; // admins create anything
  if (isGm(auth.profile)) return true; // gms create anything in their campaigns

  // Players can only create PCs, never NPCs
  return characterType === "pc";
}

/**
 * Can user view a character?
 * Admin: sees all characters
 * GM: sees all characters in accessible campaigns
 * Player: sees characters they created + characters explicitly assigned to them
 */
export function canViewCharacter(
  auth: AuthState,
  character: { campaignId: string; createdBy?: string | null },
  characterType: "pc" | "npc"
): boolean {
  if (!auth.profile) return false;

  // Admin sees everything
  if (isAdmin(auth.profile)) return true;

  // GMs see all characters in accessible campaigns
  if (isGm(auth.profile) && canViewCampaign(auth, character.campaignId)) return true;

  // Players never see NPCs
  if (characterType === "npc") return false;

  // Players see PCs they created
  if (character.createdBy === auth.profile.id) return true;

  // Players see PCs explicitly shared with them
  // (checked via character.id lookup in characterRolesByCharacterId)
  return false; // caller will check characterRolesByCharacterId
}

/**
 * Can user edit a character?
 * Editor access: can edit
 * Viewer access: cannot edit
 * Role-based:
 *   Admin: edits everything
 *   GM: edits all characters in accessible campaigns
 *   Player: edits characters they created or have editor access to
 */
export function canEditCharacter(
  auth: AuthState,
  character: { campaignId: string; createdBy?: string | null; id: string },
  _characterType: "pc" | "npc", // Reserved for future use, not currently differentiated
  characterAccess: CharacterAccessRole | null // null = no explicit access
): boolean {
  if (!auth.profile) return false;

  // Admin edits everything
  if (isAdmin(auth.profile)) return true;

  // GMs edit all characters in accessible campaigns
  if (isGm(auth.profile) && canViewCampaign(auth, character.campaignId)) return true;

  // Players can edit characters they created
  if (character.createdBy === auth.profile.id) return true;

  // Players can edit if they have explicit editor access
  if (characterAccess === "editor") return true;

  return false;
}

/**
 * Can user see/view a character directly (no access check needed, only permission check)?
 * Used for filtered character lists and sidebar.
 */
export function canDirectlyViewCharacter(
  auth: AuthState,
  character: { campaignId: string; createdBy?: string | null; id: string },
  characterType: "pc" | "npc",
  characterAccessRole: CharacterAccessRole | null
): boolean {
  if (!auth.profile) return false;

  // Admin sees all
  if (isAdmin(auth.profile)) return true;

  // GMs see all in their campaigns
  if (isGm(auth.profile) && canViewCampaign(auth, character.campaignId)) return true;

  // Players never see NPCs
  if (characterType === "npc") return false;

  // Players see characters they created
  if (character.createdBy === auth.profile.id) return true;

  // Players see characters with any access (viewer or editor)
  if (characterAccessRole !== null) return true;

  return false;
}

/**
 * Can user assign character access to other players?
 * Admin: can manage all character access
 * GM: can manage character access in accessible campaigns
 * Player: never
 */
export function canManageCharacterAccess(
  auth: AuthState,
  character: { campaignId: string }
): boolean {
  if (!auth.profile) return false;
  if (isAdmin(auth.profile)) return true;
  return canEditCampaign(auth, character.campaignId);
}

/**
 * Should a character be shown in the character list for this user?
 * This combines view permission + list visibility logic.
 */
export function shouldShowCharacterInList(
  auth: AuthState,
  character: {
    id: string;
    campaignId: string;
    createdBy?: string | null;
    characterType?: "pc" | "npc";
  },
  characterAccessRole: CharacterAccessRole | null
): boolean {
  const charType = (character.characterType ?? "pc") as "pc" | "npc";
  return canDirectlyViewCharacter(auth, character, charType, characterAccessRole);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UI hint / guidance queries
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get the list of roles this user should see hints for.
 * Used by guidance system to determine which hints apply.
 */
export function getHintRoles(auth: AuthState): ("admin" | "gm" | "player")[] {
  return getEffectiveRoles(auth);
}

/**
 * Should show admin/user-management hints?
 */
export function shouldShowAdminHints(auth: AuthState): boolean {
  return isAdmin(auth.profile);
}

/**
 * Should show GM/campaign-management hints?
 */
export function shouldShowGmHints(auth: AuthState): boolean {
  return isGm(auth.profile) || isAdmin(auth.profile);
}

/**
 * Should show player/character-creation hints?
 */
export function shouldShowPlayerHints(auth: AuthState): boolean {
  return Object.keys(auth.campaignRolesByCampaignId).length > 0
    || isGm(auth.profile)
    || isAdmin(auth.profile);
}

/**
 * Should show NPC-related UI elements (filters, create button, badges)?
 * Only admins and GMs should see NPC controls.
 * Players should never see NPCs or NPC-related UI.
 */
export function shouldShowNpcControls(auth: AuthState): boolean {
  return isAdmin(auth.profile) || isGm(auth.profile);
}
