# Character Builder

[![Deploy Vercel](https://github.com/rustyschafer-407/character-builder/actions/workflows/deploy-vercel.yml/badge.svg)](https://github.com/rustyschafer-407/character-builder/actions/workflows/deploy-vercel.yml)

Character Builder is a campaign-aware character management app for creating, editing, leveling, and exporting RPG characters.

## What The App Does

- Lets you define campaign content in an admin editor.
- Lets players create characters from campaign + class definitions.
- Supports level-up progression with automatic and choice-based gains.
- Exports characters to Roll20 via a single MOD import command (copy-paste into Roll20 chat).

## Campaign Ownership Model

Each campaign owns its own gameplay content. In this app, campaigns contain:

- Classes
- Skills
- Powers
- Items
- Attack templates

Characters are tied to a campaign and class, and all available options are resolved from that campaign.

## Character Creation And Level-Up

Character creation wizard (high level):

- Pick campaign and class.
- Set attributes by generation method (defaults to Point Buy).
- Choose exactly 2 save proficiencies.
- Make class-constrained skill/power/item choices.
- Finish with a full character record.

Level-up wizard (high level):

- Computes the next level and reads that class progression row.
- Applies automatic gains (level, HP/hit dice, attribute bonuses).
- Requires choices for new skills/powers when configured.
- Blocks invalid or duplicate applications.

## Roll20 Mod Workflow (High Level)

The app generates a single MOD import command containing all character data.

Typical flow:

- Open a character in this app.
- Click **Copy to Roll20** in the character identity panel.
- In Roll20 (with the Character Builder MOD installed), paste the command into chat.
- The MOD applies all attributes and repeating sections in one pass.

## Commands

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build production bundle:

```bash
npm run build
```

Run lint:

```bash
npm run lint
```

Build with staging mode (reads `.env.staging` / `.env.staging.local`):

```bash
npm run build:staging
```

## Staging And Production

This app uses Vite environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Recommended branch strategy:

- `staging` branch deploys to staging host and uses staging Supabase project
- `main` branch deploys to production host and uses production Supabase project

Local staging test:

1. Create `.env.staging.local` with staging Supabase values.
2. Run `npm run dev:staging` or `npm run build:staging`.

Hosted staging deploy:

1. In your hosting provider, set staging environment variables for branch `staging`.
2. Push to `staging`.
3. Validate in staging, then promote by merging `staging` into `main`.

## Automated Deploys (GitHub Actions + Vercel)

This repo includes [deploy-vercel workflow](.github/workflows/deploy-vercel.yml):

Bootstrap admin workflow is available at [bootstrap-admin workflow](.github/workflows/bootstrap-admin.yml) and is intended for one-time per-environment admin setup using repository secrets.

Detailed setup and repeatable deploy steps live in [DEPLOYMENT.md](DEPLOYMENT.md).

- Push to `staging` deploys to Vercel preview (staging)
- Push to `main` deploys to Vercel production
- You can also run it manually with `workflow_dispatch`

Set these GitHub repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Recommended Vercel environment setup:

- Preview environment vars point to staging Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Production environment vars point to production Supabase

Bootstrap initial admin (one-time per environment):

1. Export server-only vars in your shell:
- `SUPABASE_URL` (or use `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD`
2. Run:

```bash
npm run bootstrap:admin
```

This creates/updates the owner profile with `is_admin=true` and `is_gm=true` and is safe to re-run.

## Release Checklist

1. Push feature changes to `staging`.
2. Confirm Deploy Vercel workflow passes for `staging`.
3. Run [SMOKE_TEST_CHECKLIST.md](SMOKE_TEST_CHECKLIST.md) against staging.
4. Confirm staging uses staging Supabase data only.
5. Merge `staging` into `main`.
6. Confirm Deploy Vercel workflow passes for `main`.
7. Perform a quick production sanity pass.

## Developer Smoke Test

Use [SMOKE_TEST_CHECKLIST.md](SMOKE_TEST_CHECKLIST.md) for a quick manual validation pass after changes.

## Architecture Overview

- `src/components/` UI screens and editor/wizard sections.
- `src/data/` seeded and normalized game data by campaign/genre.
- `src/lib/` character logic and Roll20 export command builders.
- `src/storage/` localStorage load/save and migration defaults.
- `src/types/` shared TypeScript domain models.
- `src/App.tsx` top-level app orchestration and workflows.

## Repository Layout

- `src/` Character generator web app (React + Vite).
- `supabase/` SQL migrations and backend schema assets.
- `roll20-sheet/` Roll20 character sheet source files (`sheet.html`, `sheet.css`).
