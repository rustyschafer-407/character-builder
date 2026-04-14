# Character Builder

Character Builder is a campaign-aware character management app for creating, editing, leveling, and exporting RPG characters.

## What The App Does

- Lets you define campaign content in an admin editor.
- Lets players create characters from campaign + class definitions.
- Supports level-up progression with automatic and choice-based gains.
- Exports characters to Roll20 using ChatSetAttr Mod-compatible commands.

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
- Set attributes by generation method.
- Make class-constrained skill/power/item choices.
- Finish with a full character record.

Level-up wizard (high level):

- Computes the next level and reads that class progression row.
- Applies automatic gains (level, HP/hit dice, attribute bonuses).
- Requires choices for new skills/powers when configured.
- Blocks invalid or duplicate applications.

## Roll20 Mod Workflow (High Level)

The app generates ChatSetAttr Mod commands in two phases:

1. Attributes and core fields
2. Repeating sections (skills, attacks, powers, inventory)

Typical flow:

- Open a character in this app.
- Copy the generated commands.
- In Roll20 (with ChatSetAttr Mod), select the token and paste phase 1 then phase 2.

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
