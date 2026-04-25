# Security & Permissions Refactor - April 2026

## Summary

This document tracks the comprehensive security refactor to simplify and centralize the permission model for Character Builder. The goal is to achieve a clean, understandable, and maintainable permissions system aligned with the final security model.

## Final Security Model

### Global Roles

- **Admin**: Full access. Can manage everything including users, campaigns, characters, and access assignments.
- **GM**: Can create campaigns, manage campaigns they own or are assigned to, can manage all characters in those campaigns, and assign player access.
- **Player**: Can only access assigned campaigns, create PCs in those campaigns, and see/edit PCs they own or are explicitly assigned to.

### Campaign Access

- Admin: sees all campaigns
- GM: sees campaigns they own or are assigned to manage (role = "editor")
- Player: sees campaigns they are assigned to participate in (role = "player")

### Character Access

- Admin: can see/edit all characters
- GM: can see/edit all characters in their accessible campaigns
- Player: can see only their own PCs or PCs explicitly assigned to them (with "viewer" or "editor" role)
- NPC rule: Only admins and GMs can create NPCs. Players never see NPCs.

## Refactoring Progress

### ✅ Phase 1: Centralized Permissions Module

**Status**: COMPLETE

**Files Created**:
- `src/lib/permissions.ts` - Single source of truth for all authorization logic

**Key Functions**:
- User role helpers: `isAdmin()`, `isGm()`, `isPlayer()`, `getEffectiveRoles()`
- User management: `canManageUsers()`, `canCreateUser()`, `canSetUserRoles()`
- Campaign permissions: `canCreateCampaign()`, `canViewCampaign()`, `canEditCampaign()`, `canManageCampaignAccess()`
- Character permissions: `canCreateCharacter()`, `canViewCharacter()`, `canEditCharacter()`, `canManageCharacterAccess()`, `shouldShowCharacterInList()`
- UI helpers: `shouldShowNpcControls()`, `shouldShowAdminHints()`, `shouldShowGmHints()`, `shouldShowPlayerHints()`

**Design Decisions**:
- All functions take `AuthState` (profile + campaign roles + character roles)
- Pure functions with no side effects
- No reliance on global state or React contexts
- Aligned with Supabase RLS policies for server-side enforcement

### ✅ Phase 2: App.tsx Refactor

**Status**: COMPLETE

**Changes**:
- Added import of `Permissions` module and `AuthState` type
- Replaced scattered `uiCanX` variables with centralized checks
- Build `authState` memo from profile + campaign roles + character roles
- Removed `restrictToPcOnly` pattern in favor of permission-based filtering
- Updated character edit logic to use `canEditCharacter()`
- Simplified candidate list building to use `Permissions.isAdmin()`

**Before**: ~30 inlined permission checks scattered across App.tsx
**After**: All checks use `Permissions.*()` functions

### ✅ Phase 3: Sidebar Simplification

**Status**: COMPLETE

**Changes**:
- Removed `restrictToPcOnly` prop in favor of `authState` prop
- NPC visibility now controlled by `Permissions.shouldShowNpcControls()`
- Character list filtering uses centralized `shouldShowCharacterInList()` check
- NPC filter buttons only shown to admins/GMs (not players)

**Benefit**: Players never see NPC controls, removing confusion

### ⏳ Phase 4: Guidance System Alignment (IN PROGRESS)

**Objective**: Refactor hints to use centralized permissions

**Status**: Partial

**What's Done**:
- Updated `guidanceSteps.ts` header documentation to reference permissions
- Guidance system already has role-based hints

**Still Needed**:
- Update `GuidanceProvider` to pass full `authState` or permission checks
- Update hint conditions to verify permissions before showing ("don't hint if user can't perform action")
- Add hints for players to create characters
- Ensure admin-only hints don't appear for GMs without those permissions

### ⏳ Phase 5: AccessManagementPanel Cleanup

**Objective**: Simplify "direct vs inherited" terminology

**Status**: Not started

**Current Issues**:
- Complex tabs/sections for "direct" vs "inherited" access
- Confusing language for players (who shouldn't see this section)
- Scattered permission validation

**What Needs to Happen**:
- Only show this panel to admins/GMs (`canManageCampaignAccess` or `canManageCharacterAccess`)
- Remove "direct/inherited" complexity for normal users
- Simplify campaign members section: show user + role + action buttons
- Simplify character access section: show user + access level + action buttons
- Add helper text: "Admins and GMs assigned to this campaign can already manage this character"

### ❌ Phase 6: Scattered Permission Logic Cleanup

**Objective**: Remove duplicated/conflicting permission checks

**Status**: Not started

**Known Issues**:
- Character access stored as `characterCanEditByCharacterId` AND `characterRolesByCharacterId`
- Some functions check campaign role via `campaignRolesByCampaignId`, others use `currentCampaignRole`
- `uiCanOpenAccessManagement` had special logic that might be redundant now
- Some NPC checks use inline logic instead of centralized check

**What Needs to Happen**:
- Audit all permission checks across codebase
- Consolidate duplicate character access tracking
- Remove redundant validation logic
- Ensure consistent naming

### ❌ Phase 7: Hints Feature Refactor

**Objective**: Final guidance system alignment

**Status**: Not started

**Expected Hints**:
- **Admin**: Manage users, create/assign users, assign campaigns, create campaigns, set campaign options, create PCs/NPCs, assign character access
- **GM**: Create campaign, configure campaign, create PCs/NPCs, manage character access, review campaign members
- **Player**: Create character (if in campaign), edit my character, export to Roll20
- **Anti-annoyance**: Don't repeat hints, don't show if action unavailable, cooldown tracking

### ⚙️ Phase 8: Testing & Validation

**Status**: Not started

**Validation Scenarios**:

Admin flows:
- [ ] Can see all campaigns
- [ ] Can create campaign
- [ ] Can edit campaign setup
- [ ] Can create user
- [ ] Can set user email/password
- [ ] Can mark user as GM or Player
- [ ] Can assign user to campaign
- [ ] Can create PC and NPC
- [ ] Can assign character access

GM flows:
- [ ] Can see only accessible campaigns
- [ ] Can create campaign
- [ ] Can edit own campaigns
- [ ] Can see all characters in own campaigns
- [ ] Can create PC and NPC
- [ ] Can manage player access
- [ ] Does NOT see global admin tools

Player flows:
- [ ] Can see only assigned campaigns
- [ ] Cannot see campaign setup
- [ ] Can create new PC
- [ ] Automatically can edit own PC
- [ ] Does NOT see NPCs
- [ ] Cannot create NPCs
- [ ] Can see assigned PCs only
- [ ] Can edit if access level is editor

**Regression Checks**:
- [ ] Admin view doesn't break
- [ ] GM inherited rights still work
- [ ] No "Unknown user" / "No email" errors
- [ ] No stale/duplicate hints
- [ ] No hidden routes to campaign setup for players
- [ ] No NPC references in player views

## Implementation Checklist

- [x] Create `src/lib/permissions.ts`
- [x] Refactor `src/App.tsx` permission checks
- [x] Simplify `src/components/Sidebar.tsx` NPC filtering
- [ ] Update `src/components/GuidanceProvider.tsx` for fuller context
- [ ] Simplify `src/components/AccessManagementPanel.tsx` UI
- [ ] Audit `src/lib/cloudRepository.ts` for scattered checks
- [ ] Audit `src/hooks/` for permission logic
- [ ] Remove `restrictToPcOnly` pattern entirely
- [ ] Consolidate character access tracking
- [ ] Update hints for permission awareness
- [ ] Add "Create character" hint for players
- [ ] Remove "direct/inherited" language
- [ ] End-to-end testing
- [ ] Deployment to staging
- [ ] Production deployment

## Key Files Modified

- `src/lib/permissions.ts` (new)
- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/lib/guidanceSteps.ts` (header docs)

## Files to Review Next

- `src/components/AccessManagementPanel.tsx` - Complex access management UI
- `src/components/GuidanceProvider.tsx` - Hint system
- `src/lib/cloudRepository.ts` - Data layer permission checks
- `src/hooks/useCloudSync.ts` - Sync layer permission logic
- `supabase/migrations/*.sql` - RLS policies (ensure aligned)

## Design Principles

1. **Single Source of Truth**: All permission logic in `src/lib/permissions.ts`
2. **No Duplication**: Don't repeat permission checks
3. **Defense in Depth**: Check permissions in UI, RLS policies, and data fetching
4. **Fail Secure**: Default deny; explicitly grant permissions
5. **User-Friendly**: Hide confusing UI from players; show only relevant controls
6. **Testable**: Pure functions, easy to unit test
7. **Self-Documenting**: Function names clearly indicate what they check

## Questions & Decisions

1. **Should permissions be checked in both UI and RLS only?**
   - Answer: Yes. UI for UX, RLS for security. Don't rely on UI hiding alone.

2. **Should we consolidate character access tracking?**
   - Answer: Yes, consolidate to single source of truth in data layer

3. **How to handle "Admin acting as GM in a campaign"?**
   - Answer: Admin is always treated as having full access; no special case needed

4. **Should hints show for unavailable actions?**
   - Answer: No. Each hint should check permissions before appearing

5. **Is "direct vs inherited" language needed for players?**
   - Answer: No. Players should never manage access; we remove this section entirely for them

## Success Criteria

- [ ] All permission checks use centralized module
- [ ] No `restrictToPcOnly` pattern remains
- [ ] Players never see NPCs or NPC controls
- [ ] Players never see campaign setup UI
- [ ] Players never see user management sections
- [ ] Hints only appear to users who can perform the action
- [ ] No duplicate/conflicting permission logic
- [ ] All tests pass
- [ ] TypeScript compiles cleanly
- [ ] No regressions in existing flows

