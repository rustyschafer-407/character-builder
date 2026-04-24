# CB Permissions Test Matrix

Use this matrix for migration validation, local QA, and pre-deploy smoke checks.

## Test Accounts
- `admin1`: `is_admin=true`, `is_gm=true`
- `gm1`: `is_admin=false`, `is_gm=true`
- `player1`: no global flags
- `player2`: no global flags

## Seed Setup
- Campaign `C1` created by `gm1`.
- Campaign access:
- `gm1` = `editor`
- `player1` = `player`
- `player2` = `player`
- Characters in `C1`:
- `CH_A` created by `player1`
- `CH_B` created by `player2`
- Explicit character access:
- `player1` gets `viewer` on `CH_B`
- `player2` gets no access to `CH_A`

## Authorization Matrix

| ID | Actor | Action | Expected |
|---|---|---|---|
| A1 | admin1 | View any campaign | Allow |
| A2 | admin1 | Edit any campaign | Allow |
| A3 | admin1 | View/edit any character | Allow |
| A4 | admin1 | Assign campaign/character access | Allow |
| G1 | gm1 | Create campaign | Allow |
| G2 | player1 | Create campaign | Deny |
| C1 | gm1 (campaign editor) | View `CH_A`, `CH_B` in `C1` | Allow |
| C2 | gm1 (campaign editor) | Edit `CH_A`, `CH_B` in `C1` | Allow |
| P1 | player1 (`player` on `C1`) | View campaign `C1` | Allow |
| P2 | player1 (`player` on `C1`) | Create character in `C1` | Allow |
| P3 | player1 | View own `CH_A` | Allow |
| P4 | player1 | Edit own `CH_A` | Allow |
| P5 | player1 | View `CH_B` with explicit `viewer` | Allow |
| P6 | player1 | Edit `CH_B` with explicit `viewer` only | Deny |
| P7 | player2 | View `CH_A` with no assignment | Deny |
| P8 | player2 | Edit `CH_A` with no assignment | Deny |
| X1 | unauthenticated | Read campaigns/characters | Deny |
| X2 | unauthenticated | Write campaigns/characters | Deny |

## Derived Rule Checks

| ID | Rule | Validation |
|---|---|---|
| D1 | Campaign creator auto-editor | Creator of new campaign immediately can edit it |
| D2 | Character creator auto-editor | Creator of new character immediately can edit it |
| D3 | Campaign editor overrides character assignment | Campaign editor can edit character even without row in `character_user_access` |
| D4 | Character access is additive | Adding `viewer/editor` only affects that character |
| D5 | Admin override | Admin remains allowed even if no access rows exist |

## Bootstrap Admin Checks

| ID | Scenario | Expected |
|---|---|---|
| B1 | Fresh deploy bootstrap runs | Admin auth user exists and can sign in |
| B2 | Fresh deploy bootstrap runs | `profiles.is_admin=true` and `profiles.is_gm=true` for bootstrap user |
| B3 | Bootstrap rerun | No duplicate user/profile rows created |
| B4 | Existing unrelated admins | Rerun does not downgrade/overwrite existing admins |
| B5 | Missing bootstrap env vars | Fails safely with clear server log/error |

## RLS Policy Regression Checks (direct API/SQL)
- Attempt `player1` update on `CH_B` with only `viewer`: must fail.
- Attempt `player2` select on `CH_A` with no access: must return no row.
- Attempt non-GM campaign insert: must fail.
- Attempt privileged profile role change (`is_admin`/`is_gm`) from client: must fail.

## Minimal UX/Auth Checks
- Sign-up works with minimal password UX (no custom strength rules).
- Sign-in persists session across refresh.
- Sign-out removes access to protected data immediately.
- Permission-denied actions surface clear, non-technical errors.

## Exit Criteria
- All matrix rows pass in staging.
- No unauthorized read/write found in direct API tests.
- Bootstrap admin validated during deployment rehearsal.
