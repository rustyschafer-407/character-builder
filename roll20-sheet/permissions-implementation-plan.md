# CB Permissions Implementation Plan

## Objective
Ship enforceable RBAC for Character Builder using Supabase email/password auth, RLS, and minimal UX changes.

## Canonical Model (v1)
- Auth: Supabase email/password.
- Global roles on `profiles`: `is_admin`, `is_gm`.
- Campaign roles: `player`, `editor` in `campaign_user_access`.
- Character roles: `viewer`, `editor` in `character_user_access`.
- Campaign editors can edit all characters in their campaign.
- Campaign players can create characters, but only access characters they own or are explicitly assigned.
- Bootstrap admin account must exist after deployment and be able to sign in.

## Current State Gap (from existing code)
- `supabase/migrations/0001_initial_shared_access.sql` uses open policies (`using (true)`) for campaigns/characters.
- No `profiles`, `campaign_user_access`, or `character_user_access` tables yet.
- `src/lib/supabaseClient.ts` disables auth session persistence/refresh.
- `src/lib/cloudRepository.ts` assumes global read/write access.

## Implementation Phases

### Phase 1: Schema + data migration
Create new migration (example: `supabase/migrations/0002_permissions_rbac.sql`) to:
1. Add `profiles` table linked to `auth.users`.
2. Add `created_by` to `campaigns` and `characters` (non-null after backfill).
3. Add `campaign_user_access` (`player|editor`) and `character_user_access` (`viewer|editor`).
4. Add indexes:
- `campaign_user_access(user_id, campaign_id)`
- `character_user_access(user_id, character_id)`
- `characters(campaign_id, created_by)`
5. Backfill existing rows safely:
- If legacy rows have no creator, set `created_by` to bootstrap admin or scripted owner mapping.
- Insert creator access rows (`campaign editor`, `character editor`).

### Phase 2: Helper SQL functions + RLS
In the same migration (or `0003_permissions_rls.sql`):
1. Enable RLS on:
- `profiles`
- `campaigns`
- `campaign_user_access`
- `characters`
- `character_user_access`
2. Add helper functions:
- `is_admin(uid uuid)`
- `is_campaign_editor(uid uuid, campaign uuid)`
- `has_campaign_access(uid uuid, campaign uuid)`
- `can_view_character(uid uuid, character uuid)`
- `can_edit_character(uid uuid, character uuid)`
3. Replace open policies with role-based policies per matrix:
- Campaign create: admin or `profiles.is_gm`.
- Campaign edit: admin or campaign editor.
- Character create: admin or campaign `player|editor`.
- Character view/edit: admin OR campaign editor OR creator OR explicit character role (`viewer` for view, `editor` for edit).

### Phase 3: Bootstrap admin (deployment-safe)
Implement one-time bootstrap flow (SQL script or server-only endpoint):
1. Read credentials from server env vars, never hardcoded.
2. Ensure auth user exists (create if missing).
3. Upsert `profiles` row with `is_admin = true`, `is_gm = true`.
4. Idempotent guard: if an admin already exists, do not downgrade/overwrite unrelated admins.
5. Log success/failure for deploy visibility.

Exact setup steps:
1. Set server-only environment variables in your shell/CI (never commit secrets):
- `SUPABASE_URL` (or fallback `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
2. Run one-time bootstrap command:
- `npm run bootstrap:admin`
3. Verify:
- Auth user exists for bootstrap email.
- `profiles.is_admin = true` and `profiles.is_gm = true` for that user.
4. Re-run safety:
- Script is idempotent.
- Existing password is unchanged unless `BOOTSTRAP_UPDATE_PASSWORD=true` is explicitly provided.

Global role mutation boundary:
- `profiles.is_admin` and `profiles.is_gm` updates are server-only.
- Do not perform global role mutation from browser client code.
- Use trusted script flow (`npm run roles:set`) with `SUPABASE_SERVICE_ROLE_KEY`.

Recommended env vars:
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### Phase 4: Client auth wiring (minimal UX)
Update auth/client wiring:
1. `src/lib/supabaseClient.ts`
- Enable normal auth session behavior (`persistSession: true`, `autoRefreshToken: true`).
2. Add auth flows (sign-in/sign-up/sign-out) with minimal password UX.
- No custom strength meter/rules beyond Supabase requirements.
3. Require authenticated session before loading protected app data.
4. Load current `profiles` row after login and keep in app state.

### Phase 5: Repository/query refactor
Refactor `src/lib/cloudRepository.ts` and related hooks/components:
1. Scope campaign queries to rows visible under RLS.
2. On campaign create, insert campaign then grant creator `editor` access.
3. On character create, insert character with `created_by` then grant creator `editor` access.
4. Add access-management operations:
- Campaign: grant/revoke `player|editor`.
- Character: grant/revoke `viewer|editor`.
5. Handle policy errors explicitly (show permission-denied feedback).

### Phase 6: Admin/GM UI
Add concise admin surfaces:
1. Admin user management:
- View users
- Toggle `is_admin`/`is_gm` (server-only mutations)
2. Campaign access management:
- Add/remove campaign `player|editor`
3. Character access management:
- Add/remove character `viewer|editor`

## RLS Policy Safety Requirements
- All INSERT and UPDATE policies must include appropriate `with check` clauses.
- Campaign insert must require `created_by = auth.uid()` unless admin/server-side bootstrap.
- Character insert must require `created_by = auth.uid()` unless admin/server-side bootstrap.
- Users may not grant themselves campaign or character access by inserting access rows directly.
- Access-table policies must avoid recursive RLS problems.
- Helper functions should be stable, security-definer where appropriate, and search_path-safe.
- Existing `using (true)` policies must be dropped, not merely supplemented.

## Security Rules (non-negotiable)
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client bundles.
- All privileged mutations (user creation, role elevation) are server-only.
- Client must rely on authenticated Supabase session; no fake identity selection.

## Definition of Done
- Non-admin users cannot read/write unauthorized campaigns/characters via direct API calls.
- Campaign editor can edit every character in their campaign.
- Campaign player can create characters but can only access owned/assigned characters.
- Bootstrap admin can sign in immediately after deployment.
- RLS policies and auth flows pass the test matrix in `permissions-test-matrix.md`.
