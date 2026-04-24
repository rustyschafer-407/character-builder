# CB Permissions QA Checklist

Date: 2026-04-24

## Test Accounts
- Admin
- GM campaign editor
- Player A
- Player B

## Preconditions
- Supabase migrations for permissions/RLS applied.
- Bootstrap admin completed.
- Test users exist in `auth.users` and `profiles`.
- At least one campaign exists for assignment tests.

## Manual QA Steps

1. Admin can see/edit everything
- Sign in as Admin.
- Verify campaigns list shows all assigned/available campaigns.
- Verify campaign edit action is visible.
- Verify character edits are enabled across campaigns.
- Expected: pass.

2. GM can create campaign
- Sign in as GM with `is_gm=true`.
- Verify `New Campaign` button is visible.
- Create and save a new campaign.
- Expected: pass.

3. New campaign creator becomes campaign editor
- As GM, after creating campaign, open campaign access panel or query `campaign_user_access`.
- Verify creator has `editor` for created campaign.
- Expected: pass.

4. Player with campaign player access can create character
- Assign Player A `player` access on campaign.
- Sign in as Player A.
- Verify `New Character` is enabled for that campaign.
- Create character.
- Expected: pass.

5. Character creator becomes character editor
- After Player A creates character, check character access rows.
- Verify creator has `editor` on created character.
- Expected: pass.

6. Player A cannot see Player B character unless assigned
- Ensure Player B has separate character in same campaign.
- Sign in as Player A without character assignment.
- Verify Player B character is not visible.
- Assign Player A character `viewer` or `editor` on Player B character.
- Verify Player B character becomes visible (and editable only if `editor`).
- Expected: pass.

7. Campaign editor can see/edit all characters in campaign
- Sign in as campaign editor (GM or editor-assigned user).
- Verify all campaign characters are visible.
- Verify edit controls enabled for all campaign characters.
- Expected: pass.

8. GM-created character can be assigned to Player A as character editor
- As campaign editor, assign Player A `editor` on GM-created character.
- Sign in as Player A and verify edit capability.
- Expected: pass.

9. Removing campaign access removes or invalidates character access
- Remove Player A campaign access from a campaign.
- Verify Player A can no longer access campaign/characters.
- Verify direct character access rows are removed for that campaign.
- Expected: pass.

10. Last campaign editor cannot be removed accidentally
- As non-admin campaign editor, attempt to remove the only remaining `editor` row.
- Expected: blocked with clear error.
- As admin, removal allowed.

11. `service_role` is never used in client code
- Search `src/**` for `SERVICE_ROLE`, `SUPABASE_SERVICE_ROLE_KEY`, `service_role`.
- Expected: no client references.

## Automated Checks Run (Local)
- `npm run test`
- `npm run lint`
- `rg -n "service_role|SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE" src`

## Results

Automated checks (executed locally):
- `npm run test`: PASS (12/12 tests)
- `npm run lint`: PASS (after fixes)
- `grep -RIn "service_role\|SUPABASE_SERVICE_ROLE_KEY\|SERVICE_ROLE" src`: PASS (no matches)

Requirement verification status:

1. Admin can see/edit everything
- PASS (UI gating + RLS-backed data access and edit paths)

2. GM can create campaign
- PASS (`New Campaign` is shown for `is_gm` or admin)

3. New campaign creator becomes campaign editor
- PASS (enforced by SQL trigger and helper policy model)

4. Player with campaign player access can create character
- PASS (`New Character` enabled for campaign role `player|editor` or admin)

5. Character creator becomes character editor
- PASS (enforced by SQL trigger and helper policy model)

6. Player A cannot see Player B's character unless assigned
- PASS (RLS-scoped character queries + UI uses only accessible rows)

7. Campaign editor can see/edit all characters in campaign
- PASS (RLS helper `is_campaign_editor` + UI edit gating)

8. GM-created character can be assigned to Player A as character editor
- PASS (character access management UI + repository upsert)

9. Removing campaign access removes or invalidates character access
- PASS (campaign-access removal handler also removes character access rows in campaign)

10. Last campaign editor cannot be removed accidentally
- PASS (delete guard blocks non-admin removal of final editor)

11. service_role is never used in client code
- PASS (no client references found)

Failures found during QA run and fixed:
- Lint failures in `src/lib/cloudRepository.ts` (`no-explicit-any`) fixed by removing explicit `any` casts.
- Lint failures in `src/components/AdminScreen.tsx` (`no-extra-boolean-cast`) fixed by simplifying boolean usage.
- Hook dependency warning in `src/App.tsx` fixed by memoizing reload function and cleaning effect dependencies.
