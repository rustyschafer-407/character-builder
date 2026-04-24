# Deployment Runbook

## Overview

This project deploys with GitHub Actions and Vercel.

- `staging` branch -> Vercel Preview -> staging Supabase
- `main` branch -> Vercel Production -> production Supabase

Workflow file:

- [.github/workflows/deploy-vercel.yml](.github/workflows/deploy-vercel.yml)

## One-Time Setup

### 1. Create Vercel token

1. Open `https://vercel.com/account/tokens`
2. Create a token with a descriptive label such as `github-actions-character-builder`
3. Copy the raw token value

### 2. Get Vercel IDs

Project ID:

1. Open the `character-builder` project in Vercel
2. Go to `Settings`
3. Go to `General`
4. Copy `Project ID`

Org ID:

1. Open Vercel account or team `Settings`
2. Go to `General`
3. Copy `Account ID` or `Team ID`

### 3. Add GitHub repository secrets

In GitHub repo settings, add these Actions secrets:

- `VERCEL_TOKEN` = raw token value from Vercel Tokens page
- `VERCEL_ORG_ID` = Vercel Account ID or Team ID
- `VERCEL_PROJECT_ID` = Vercel Project ID

For manual bootstrap-admin workflow, also add:

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_BOOTSTRAP_ADMIN_EMAIL`
- `STAGING_BOOTSTRAP_ADMIN_PASSWORD`
- `PRODUCTION_SUPABASE_URL`
- `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`
- `PRODUCTION_BOOTSTRAP_ADMIN_EMAIL`
- `PRODUCTION_BOOTSTRAP_ADMIN_PASSWORD`

### 4. Add Vercel environment variables

Preview environment:

- `VITE_SUPABASE_URL` = staging Supabase URL
- `VITE_SUPABASE_ANON_KEY` = staging Supabase anon key

Production environment:

- `VITE_SUPABASE_URL` = production Supabase URL
- `VITE_SUPABASE_ANON_KEY` = production Supabase anon key

### 5. Bootstrap initial admin account (one-time per environment)

Use the server-only script. Do not run this in browser code.

Required environment variables:

- `SUPABASE_URL` = Supabase project URL (or use `VITE_SUPABASE_URL` as fallback)
- `SUPABASE_SERVICE_ROLE_KEY` = service role key (server-only)
- `BOOTSTRAP_ADMIN_EMAIL` = owner/admin email
- `BOOTSTRAP_ADMIN_PASSWORD` = owner/admin password

Optional:

- `BOOTSTRAP_UPDATE_PASSWORD=true` only if you explicitly want to rotate password for an existing admin user

Run:

```bash
npm run bootstrap:admin
```

GitHub Actions alternative (recommended for hosted environments):

1. Open `Actions` in GitHub.
2. Select workflow `Bootstrap Admin`.
3. Click `Run workflow`.
4. Choose `target` (`staging` or `production`).
5. Keep `update_password=false` unless explicit password rotation is intended.
6. Run the workflow and confirm success.

Expected outcome:

- Auth user exists for `BOOTSTRAP_ADMIN_EMAIL`
- `public.profiles` row exists with `is_admin = true` and `is_gm = true`

Safety properties:

- Idempotent: safe to run multiple times
- Existing password is not changed unless `BOOTSTRAP_UPDATE_PASSWORD=true`
- No credentials committed to repository files
- `SUPABASE_SERVICE_ROLE_KEY` is never exposed to client bundles

### 6. Update user global roles (server-only)

`profiles.is_admin` and `profiles.is_gm` updates must be performed from a trusted server-side context.

Required environment variables:

- `SUPABASE_URL` (or `VITE_SUPABASE_URL` fallback)
- `SUPABASE_SERVICE_ROLE_KEY`
- `TARGET_USER_EMAIL`
- `SET_IS_ADMIN` (`true` or `false`)
- `SET_IS_GM` (`true` or `false`)

Run:

```bash
npm run roles:set
```

Notes:

- This script updates profile role flags only.
- This script does not update passwords.
- Never run with service role credentials in browser/client code.

### 7. Supabase setup checklist (what was required in staging)

Use this exact checklist when preparing production Supabase.

1. Apply SQL migrations in order:
- `supabase/migrations/0002_permissions_foundation.sql`
- `supabase/migrations/0003_permissions_hardening.sql`
- `supabase/migrations/0004_fix_bootstrap_trigger.sql`

2. Why `0004` is required:
- It updates `public.enforce_profile_role_mutation()` so service-role automation can set `profiles.is_admin` and `profiles.is_gm`.
- Without it, bootstrap can fail with: `Only admins may change is_admin or is_gm`.

3. Auth URL configuration in Supabase (`Authentication -> URL Configuration`):
- Set `Site URL` to the environment URL (staging or production web app URL).
- Add redirect URLs for that environment URL.
- Keep local dev URL as needed (for example `http://localhost:5173`).
- Do not leave auth redirects pointed at `localhost` for hosted environments.

4. Google OAuth provider setup (required for Google sign-in):
- In Google Cloud Console, create OAuth credentials for a Web application.
- Configure OAuth consent screen (app name, support email, developer contact email).
- Add the exact Supabase Google callback URL from `Supabase -> Authentication -> Providers -> Google` to Google OAuth "Authorized redirect URIs".
- Copy Google Client ID and Client Secret into `Supabase -> Authentication -> Providers -> Google` and enable the provider.
- If Google consent screen is in Testing mode, add your production test/admin accounts as Test users before validation.

5. Google OAuth redirect rules:
- Google "Authorized redirect URIs" must contain the Supabase callback URL (not your Vercel app URL).
- Your app domain belongs in Supabase URL Configuration (`Site URL` and `Redirect URLs`).
- For each environment, verify Supabase URL config includes the correct environment origin.

6. Use the correct server key for admin scripts/workflows:
- `SUPABASE_SERVICE_ROLE_KEY` must be the secret key from Supabase (`Secret keys`), not the publishable key.
- Publishable keys (`sb_publishable_...`) are client-safe and will fail for server-only admin operations.

7. Bootstrap the initial admin account after migrations:
- Run `npm run bootstrap:admin` with server-only env vars, or run GitHub workflow `Bootstrap Admin` for the target environment.
- Expected result: auth user exists and `public.profiles` has `is_admin=true` and `is_gm=true` for that email.

8. Email/password fallback settings:
- App login supports Google OAuth as primary and email/password as fallback.
- Ensure Email provider is enabled in Supabase Auth when fallback is required.
- Ensure auth URLs in Supabase match the environment where users will complete sign-in.

9. Production verification checks:
- New user can sign in with Google OAuth.
- Fallback email/password sign-in works for bootstrap/admin account.
- Existing admin email can sign in and has admin capabilities.
- No signup/login links redirect to `localhost` in production.
- Access policies behave the same as staging for campaigns and characters.

## Normal Staging Deploy

1. Push changes to `staging`
2. Open GitHub Actions
3. Check the latest `Deploy Vercel` run on `staging`
4. Wait for `deploy-staging` to succeed
5. Open the preview URL from the deploy logs or the Vercel dashboard
6. Run staging validation using [SMOKE_TEST_CHECKLIST.md](SMOKE_TEST_CHECKLIST.md)

## Manual Re-Run

If a staging deploy failed before secrets were set:

1. Open GitHub `Actions`
2. Open the latest failed `Deploy Vercel` run for branch `staging`
3. Click `Re-run jobs` or `Re-run failed jobs`

Alternative:

1. Open the `Deploy Vercel` workflow
2. Click `Run workflow`
3. Choose branch `staging`
4. Choose target `staging`
5. Run the workflow

Fallback:

```bash
git commit --allow-empty -m "Retry staging deploy"
git push origin HEAD:staging
```

## Promote To Production

1. Confirm staging validation passed
2. Merge `staging` into `main`
3. Wait for the `Deploy Vercel` run on `main`
4. Verify Google OAuth provider is enabled in production Supabase and credentials are populated
5. Verify Supabase production `Site URL` and `Redirect URLs` match production domain
6. Verify the production site
7. Perform a quick sanity pass:
	- Google sign-in succeeds and redirects back to production domain
	- Bootstrap admin can sign in via email/password fallback
	- New non-assigned user sees friendly no-access state
	- No auth redirects point to localhost

## Local Validation

Run local staging mode:

```bash
npm run dev:staging
```

Build staging locally:

```bash
npm run build:staging
```

## Notes

- The app only needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Preview must point to staging Supabase
- Production must point to production Supabase
- The workflow run titles in GitHub may show the commit message rather than the workflow name
