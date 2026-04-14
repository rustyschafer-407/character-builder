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

### 4. Add Vercel environment variables

Preview environment:

- `VITE_SUPABASE_URL` = staging Supabase URL
- `VITE_SUPABASE_ANON_KEY` = staging Supabase anon key

Production environment:

- `VITE_SUPABASE_URL` = production Supabase URL
- `VITE_SUPABASE_ANON_KEY` = production Supabase anon key

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
