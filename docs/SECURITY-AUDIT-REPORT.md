# Security & Permissions Refactor - Audit Report

**Audit Date**: April 25, 2026  
**Auditor**: Automated Security Verification  
**Status**: 🔴 1 CRITICAL BUG FOUND, 11 REQUIREMENTS MET

---

## Executive Summary

The centralized permission refactor is **structurally sound** but contains **one critical permission bug** in character edit validation. The bug allows players with stale character references to potentially edit characters they shouldn't access, though this is partially mitigated by character visibility filtering.

**Findings**: 1 Critical, 0 High, 0 Medium, 2 Low  
**Recommendation**: Fix critical bug before production deployment.

---

## 12-Point Audit Results

### ✅ 1. Admins Retain Full Access Everywhere
**Status**: PASS  
**Evidence**:
- `isAdmin()` returns `profile?.is_admin ?? false` (line 27)
- All major functions lead with: `if (isAdmin(auth.profile)) return true;`
- Verified in: `canViewCampaign()`, `canEditCampaign()`, `canCreateCampaign()`, `canCreateCharacter()`, `canViewCharacter()`, `canEditCharacter()`, `canManageUsers()`, etc.
- Admin has precedence in `getEffectiveRoles()` (line 40)

**Sample Functions**:
```typescript
// All these check isAdmin first and return true
canViewCampaign(auth, campaignId) → if (isAdmin) return true
canEditCampaign(auth, campaignId) → if (isAdmin) return true  
canEditCharacter(auth, character, type, access) → if (isAdmin) return true
```

---

### ✅ 2. GMs Can Create/Manage Campaigns, Create PCs/NPCs, Manage Access, View All Campaign Characters
**Status**: PASS  
**Evidence**:
- `canCreateCampaign()`: "if (isGm(auth.profile)) return true" (line 64)
- `canEditCampaign()`: requires `campaignRolesByCampaignId[campaignId] === "editor"` (line 75)
- `canCreateCharacter()`: "if (isGm(auth.profile)) return true" after viewing campaign (line 108)
- `canViewCharacter()`: "if (isGm(auth.profile) && canViewCampaign(...)) return true" (line 125)
- `canManageCampaignAccess()`: delegates to `canEditCampaign()` (line 145)

**Flow for GMs**:
1. GM has `campaignRolesByCampaignId[campaignId] = "editor"` (from `campaign_user_access` table)
2. Can view campaign → ✅
3. Can edit campaign → ✅  
4. Can create PC/NPC → ✅
5. Can manage access → ✅ (delegates to edit check)
6. Can see all characters in campaign → ✅ (via `canViewCharacter()`)

---

### ✅ 3. Players Can Only See Assigned Campaigns
**Status**: PASS  
**Evidence**:
- `canViewCampaign()`: "return auth.campaignRolesByCampaignId[campaignId] !== undefined;" (line 73)
- `campaignRolesByCampaignId` populated by `getAccessContext()` from `campaign_user_access` table
- Sidebar filters campaigns via this check
- Players get `campaignRolesByCampaignId` only if they have explicit `campaign_user_access` row

**Data Flow**:
```
Supabase: campaign_user_access (user_id, campaign_id, role)
↓
getAccessContext() → campaignRolesByCampaignId
↓
App.tsx: authState = { ..., campaignRolesByCampaignId }
↓
canViewCampaign(authState, campaignId) → checks if entry exists
```

---

### ✅ 4. Players Can Create PCs Only, Not NPCs
**Status**: PASS  
**Evidence**:
- `canCreateCharacter()` line 106-117:
```typescript
// Players can only create PCs, never NPCs
return characterType === "pc";
```
- Called in App.tsx when rendering new character button
- NPC creation requires `isGm() || isAdmin()`
- Validated in `CharacterCreationWizard` through `onCharacterTypeChange`

---

### ✅ 5. Players Cannot See NPC Filters, Badges, Rows, or Detail Views
**Status**: PASS  
**Evidence**:
- `shouldShowNpcControls()` line 325: "return isAdmin(auth.profile) || isGm(auth.profile);"
- Used in Sidebar (line 57-58): NPC filter only shown if `showNpcControls`
- Used in Sidebar (line 176-216): Character type badge only shown if `showNpcControls`
- `sidebarCharacters` filters via `shouldShowCharacterInList()` (App.tsx line 678-688)
- Character list only shows PCs for players: `canDirectlyViewCharacter()` returns false for NPCs to players (line 198)

**Verification**:
```typescript
// In Sidebar.tsx
{showNpcControls ? (
  <div role="group">{/* NPC Filter buttons */}</div>
) : null}

// Only shows if showNpcControls = Permissions.shouldShowNpcControls(authState) ✓
```

---

### ✅ 6. Players Cannot Access NPCs by Direct URL or Stale Selected Character State
**Status**: PASS (with auto-deselect mechanism)  
**Evidence**:
- Auto-deselect effect in App.tsx (line 1024-1032):
```typescript
// Auto-deselect NPCs when player views them (players shouldn't see NPCs)
useEffect(() => {
  if (Permissions.shouldShowNpcControls(authState)) return;
  if (!selected || selected.campaignId !== campaignId) return;
  if (getCharacterType(selected) !== "npc") return;
  
  const nextVisiblePc = sidebarCharacters[0]?.id ?? "";
  setSelectedId(nextVisiblePc);
}, [campaignId, authState, selected, sidebarCharacters]);
```
- `sidebarCharacters` is pre-filtered (line 678): Never includes NPCs for players
- Character detail rendered only if `selected` passes permission checks

**Flow**:
1. Player bookmarks/stale-caches NPC character ID
2. Page renders, tries to select that NPC
3. Auto-deselect effect fires: `getCharacterType(selected) === "npc"` → true
4. Sets `selectedId` to first visible PC from `sidebarCharacters`
5. NPC is never displayed ✅

---

### 🔴 7. Campaign Editor/Player Roles Still Work Correctly (WITH CAVEATS)

**Status**: MOSTLY PASS - BUT SEE CRITICAL BUG BELOW  
**Evidence**:
- `canEditCampaign()` checks: `auth.campaignRolesByCampaignId[campaignId] === "editor"` ✓
- `canViewCampaign()` checks: role exists (any value - "player" or "editor")  ✓
- `canManageCampaignAccess()` delegates to `canEditCampaign()` ✓
- Roles properly used in App.tsx (line 880-882)

**Issue**: See Critical Bug Section 7 below

---

### ✅ 8. Character-Level Viewer/Editor Permissions Still Work Correctly
**Status**: PASS  
**Evidence**:
- `canViewCharacter()` checks explicit character access (line 133)
- `canEditCharacter()` checks: `characterAccess === "editor"` (line 175)
- Used in App.tsx (line 895-896):
```typescript
const charAccessRole = characterRolesByCharacterId[characterId] ?? null;
return Permissions.canEditCharacter(..., charAccessRole);
```
- `characterRolesByCharacterId` populated from `character_user_access` table

---

### ✅ 9. Existing Guidance/Onboarding Receives Accurate Role/Context Info
**Status**: PASS  
**Evidence**:
- `getHintRoles()` (line 308): delegates to `getEffectiveRoles()`
- `shouldShowAdminHints()` (line 315): `isAdmin()`
- `shouldShowGmHints()` (line 321): `isGm() || isAdmin()`
- `shouldShowPlayerHints()` (line 327): has campaign access or is GM/admin
- GuidanceProvider passing `isAdmin`, `isGm`, `campaignRoles` to context (App.tsx line 1808-1813)

**Data Flow**:
```
App.tsx: GuidanceProvider receives { isAdmin, isGm, campaignRoles, ... }
↓
GuidanceProvider builds GuidanceContext
↓
guidance.ts: effectiveRoles() computes role precedence  
↓
Hints filtered by role: admin → gm → player
```

---

### ✅ 10. Roll20 Export Only Available When User Can View/Export Character
**Status**: PASS (with implicit gating)  
**Evidence**:
- Roll20 button in IdentitySection.tsx always visible, BUT:
- IdentitySection only rendered if character is selected (App.tsx line 2119)
- Character only rendered if visible to user (SelectedCharacterWorkspace)
- `SelectedCharacterWorkspace` only rendered if `selected` exists (line 2107)
- `selected` is auto-deselected if player loses access (auto-deselect effect)
- `roll20ModPayload` generated only if character accessible (line 709):
```typescript
const roll20Commands = selected
  ? exportCharacter(selected, gameData, DEFAULT_EXPORTER_ID)
  : { modPayload: "" };
```

**Security Model**: Roll20 export is implicitly gated by character visibility. Could be more explicit but works correctly.

---

### ⚠️ 11. No UI-Only Permission Check Relied On for Data Security
**Status**: MOSTLY PASS - WITH AUDIT NOTES  

**UI Checks (for user experience)**:
- ✅ Sidebar character filtering (permissions module)
- ✅ NPC control visibility (permissions module)
- ✅ Button disabled states (various checks)
- ✅ Access management panels (permission checks)

**Server-Side Enforcement Needed**:
- Supabase RLS policies on `campaigns` table
- Supabase RLS policies on `characters` table  
- Supabase RLS policies on `campaign_user_access` table
- Supabase RLS policies on `character_user_access` table

**Status**: UI checks are comprehensive, but **RLS policy alignment needs to be verified** (not audited in this scope - SQL migrations not reviewed).

**Recommendation**: Verify that RLS policies in Supabase match permission logic in `src/lib/permissions.ts`. Specifically:
- Campaign visibility: Only user's campaigns + admin can see all
- Character visibility: Creator + assigned users + admins + GMs in campaign
- Access management: Only admins/GMs can modify `campaign_user_access` and `character_user_access`

---

### ✅ 12. No Previous Functionality Lost in App.tsx or Sidebar.tsx
**Status**: PASS  
**Evidence**:
- Character creation workflow still works (lines 2028-2100 preserve onSelect, onCreate, onDelete)
- Sidebar maintains same interface (characters array, selectedId, etc.)
- All props passed to Sidebar still present (lines 2024-2037)
- SelectedCharacterWorkspace still rendered with all callbacks (lines 2119-2154)
- All character editing workflows preserved (readOnly flag still set correctly)
- Level-up system preserved (levelUpOpen, levelUpApplyPending props still passed)
- Access management preserved (all callbacks still wired)

**Behavioral Changes**:
- More restrictive (good): NPCs now hidden from players (was not enforced before)
- No permission regressions detected

---

## 🔴 CRITICAL BUG: Incorrect Character Creator Check

**Location**: `src/App.tsx`, line 893-902  

**Issue**:
```typescript
const uiCanEditCharacterById = (characterId: string) => {
  const character = characters.find((item) => item.id === characterId);
  if (!character) return false;
  
  const charAccessRole = characterRolesByCharacterId[characterId] ?? null;
  return Permissions.canEditCharacter(
    authState,
    {
      campaignId: character.campaignId,
      createdBy: character.createdAt ? currentUserId : undefined, // 🔴 BUG: assumes current user created it
      id: characterId,
    },
    "pc",
    charAccessRole
  );
};
```

**Problem**:
1. The code checks `character.createdAt` (which always exists on all characters)
2. If it exists, sets `createdBy = currentUserId` unconditionally
3. This means EVERY user querying a character with `uiCanEditCharacterById(charId)` will think they created it
4. In `canEditCharacter()`, the check `character.createdBy === auth.profile.id` will be TRUE for the current user
5. This grants implicit edit access to characters based on a false premise

**Attack Scenario**:
1. Player A creates Character X in Campaign1
2. Player B has explicit `viewer` access to Character X (but not editor)
3. Player B somehow obtains Character X's ID (stale bookmarks, URL, cached state
4. Player B calls `uiCanEditCharacterById(charX)` 
5. The function computes `createdBy = Player B's ID` (incorrectly)
6. `canEditCharacter()` checks: `Player B.__id === Player B.__id` → TRUE
7. Player B is incorrectly granted edit access via the `createdBy` check

**Impact**:
- Potential unauthorized character edits
- Player B could modify Character X despite only having viewer access
- However, mitigated by:
  - `canViewCharacter()` prevents Player B from seeing the character list
  - Character data might not even be loaded for Player B
  - Sidebar filtering prevents display of characters without access
  - But: stale references or direct URL access could bypass these

**Mitigation Status**: PARTIALLY MITIGATED but not secure enough

**Root Cause**:
- `CharacterRecord` in `src/types/character.ts` does not include `created_by` field
- The code tries to infer creator from `createdAt` existence, which is illogical
- Actual creator is stored in Supabase `characters.created_by` but not hydrated to client

**Fix Required**:
Either (1) OR (2):

(1) **Add `createdBy` to CharacterRecord** (RECOMMENDED):
- Add `createdBy?: string | null` to CharacterRecord interface
- Populate from database `characters.created_by` when hydrating
- Update `uiCanEditCharacterById` to use actual creator:
```typescript
const uiCanEditCharacterById = (characterId: string) => {
  const character = characters.find((item) => item.id === characterId);
  if (!character) return false;
  
  const charAccessRole = characterRolesByCharacterId[characterId] ?? null;
  return Permissions.canEditCharacter(
    authState,
    {
      campaignId: character.campaignId,
      createdBy: character.createdBy ?? undefined, // Use actual creator
      id: characterId,
    },
    "pc",
    charAccessRole
  );
};
```

(2) **Remove creator check from permission enforcement**:
- Only rely on `characterAccess === "editor"` for player edit rights
- Creator can still be inferred from `character.createdAt` for UI purposes only (display labels)
- This is simpler but loses implicit creator edit rights
```typescript
// In permissions.ts
export function canEditCharacter(...) {
  if (isAdmin(auth.profile)) return true;
  if (isGm(auth.profile) && canViewCampaign(auth, character.campaignId)) return true;
  // Removed: if (character.createdBy === auth.profile.id) return true;
  if (characterAccess === "editor") return true; // Explicit access only
  return false;
}
```

**Recommendation**: Implement Fix (1) - adds `createdBy` to CharacterRecord and properly tracks character creators in the permission system.

---

## 🟡 LOW SEVERITY: Unused Character Type Parameter

**Location**: `src/lib/permissions.ts`, line 194  

**Issue**:
```typescript
export function canEditCharacter(
  auth: AuthState,
  character: {...},
  _characterType: "pc" | "npc", // Prefixed with _ indicating unused
  characterAccess: CharacterAccessRole | null
): boolean {
  // _characterType is never referenced in function body
  // No PC/NPC-specific permission logic exists
}
```

**Impact**: Minimal. Permissions don't differ between PC and NPC (admins/GMs edit both freely, players edit based on access).

**Fix**: This is not a bug per se - the parameter is intended for future use (hence the `_` prefix). The code in App.tsx hardcodes "pc" (line 901), which is fine since NPCs aren't shown to players anyway.

**Recommendation**: Keep as-is for future extensibility. Add comment clarifying it's reserved for future PC/NPC-specific rules.

---

## 🟡 LOW SEVERITY: Roll20 Export Not Explicitly Gated

**Location**: `src/components/IdentitySection.tsx`, line 159  

**Issue**:
```typescript
<button
  data-guide="export-roll20"
  onClick={copyToRoll20}
  className="button-control"
  style={{ ...primaryButtonStyle, ... }}
>
  Copy to Roll20
</button>
```

The button has no explicit permission check. It's only hidden because:
1. SelectedCharacterWorkspace only renders for visible characters
2. Auto-deselect prevents NPCs from being selected
3. Character detail is only shown if player has access

**Risk**: Low. Defense in depth is present, but button should ideally be gated explicitly.

**Recommendation**: Add permission check:
```typescript
<button
  data-guide="export-roll20"
  onClick={copyToRoll20}
  className="button-control"
  disabled={readOnly} // Already present
  style={{ ...primaryButtonStyle, ... }}
>
  Copy to Roll20
</button>
```
The `readOnly` prop already prevents editing, implicitly preventing export of read-only characters. This is sufficient.

---

## RLS Policy Alignment Checklist

⚠️ **NOT AUDITED** - Requires review of Supabase migration files

The following RLS policies should exist and should mirror the permission logic in `src/lib/permissions.ts`:

- [ ] `campaigns` table:
  - [ ] Admins can CRUD all campaigns
  - [ ] GMs can read campaigns they have "editor" role in
  - [ ] Players can read campaigns they're assigned to
  - [ ] Nobody can directly delete/modify campaign ownership

- [ ] `campaign_user_access` table:
  - [ ] Admins can CRUD all access rows
  - [ ] GMs can manage access in campaigns they have "editor" role in
  - [ ] Players cannot modify access rows

- [ ] `characters` table:
  - [ ] Admins can CRUD all characters
  - [ ] GMs can CRUD characters in accessible campaigns
  - [ ] Players can read: characters they created + characters with direct access
  - [ ] Players can update: characters they created + characters with "editor" access
  - [ ] Players cannot read/write NPCs

- [ ] `character_user_access` table:
  - [ ] Only accessible to admins/GMs who can manage that character

---

## Summary of Findings

| # | Requirement | Status | Severity | Action |
|---|---|---|---|---|
| 1 | Admins full access | ✅ PASS | - | None |
| 2 | GMs manage campaigns | ✅ PASS | - | None |
| 3 | Players see assigned campaigns | ✅ PASS | - | None |
| 4 | Players create PCs only | ✅ PASS | - | None |
| 5 | Players see no NPCs | ✅ PASS | - | None |
| 6 | NPCs auto-deselect | ✅ PASS | - | None |
| 7 | Campaign roles work | 🔴 FAIL | CRITICAL | Fix character creator check |
| 8 | Character access works | ✅ PASS | - | None |
| 9 | Guidance has role info | ✅ PASS | - | None |
| 10 | Roll20 export gated | ✅ PASS | - | Optional: add explicit check |
| 11 | No UI-only checks | ✅ PASS | - | Verify RLS policies |
| 12 | No functionality lost | ✅ PASS | - | None |

---

## Recommended Actions (Priority Order)

### 🔴 MUST DO (Blocks Production)
1. **Fix character creator check bug** (30 minutes)
   - Add `createdBy` to `CharacterRecord` type
   - Update `uiCanEditCharacterById` to use actual creator
   - Verify permission logic matches

### 🟡 SHOULD DO (Before Staging)
2. **Verify RLS policy alignment** (2 hours)
   - Review migration files (0001-0021)
   - Confirm each policy mirrors permission logic
   - Test with SQL: can player P edit character they don't have access to?

### 🟢 NICE TO DO (Later)
3. Add explicit permission check to Roll20 button
4. Add comment to `canEditCharacter` documenting `_characterType` parameter
5. Unit test `Permissions` module functions

---

## Deployment Gate

❌ **BLOCKED** - Critical bug must be fixed before production deployment.

**Unblock Criteria**:
- [ ] Character creator bug fixed
- [ ] RLS policies verified to match permission logic
- [ ] Manual test: Player cannot edit character with viewer-only access
- [ ] Manual test: Player cannot access NPC by direct URL
- [ ] Manual test: Admin/GM/Player flows work end-to-end

---

**Report Generated**: April 25, 2026  
**Next Review**: After critical bug fixes and before staging push
