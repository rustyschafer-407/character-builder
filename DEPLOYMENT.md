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
4. Verify the production site
5. Perform a quick sanity pass

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
