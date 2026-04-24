CB Permissions Feature Bible

Goal

Add a simple, enforceable permissions system for Character Builder (CB) so:

* admins can manage everything
* GMs can create campaigns
* campaign editors can manage a campaign and all characters in it
* campaign players can access a campaign and create their own characters
* players can only view/edit characters they own or were explicitly assigned, unless they are campaign editors

This design is intentionally small and implementation-friendly for Supabase + Vercel.

⸻

Authentication Assumption

Use standard Supabase email/password authentication for v1.

Requirements:

* Password rules should be intentionally minimal at the app UX level.
* Do not add extra complexity like custom password strength meters, forced symbols, forced uppercase, or custom validation beyond what Supabase requires.
* Keep sign-in and sign-up simple for players.
* The app should rely on real authenticated sessions so Row Level Security remains trustworthy.

Bootstrap admin requirement:

* The system must support creation of an initial admin account whose email and password are known to the app owner.
* The app owner must be able to sign in after the permissions feature is deployed.
* The initial admin account must have profiles.is_admin = true and profiles.is_gm = true.
* This bootstrap process must be safe to run once and must not overwrite or downgrade an existing admin.
* Prefer using environment variables for bootstrap credentials or a one-time SQL/admin script, not hardcoded credentials committed to the repo.

Notes:

* Admin can still create or invite users via server-only flows later if needed.
* Passwordless auth can be revisited later, but is not part of this feature packet.
* Do not implement any fake authentication based only on selecting a user id or display name.

⸻

Canonical Roles

Global roles

* is_admin: boolean
* is_gm: boolean

Campaign access roles

* player
* editor

Character access roles

* viewer
* editor

⸻

Core Rules

Admin

Admin can:

* view/edit all campaigns
* view/edit all characters
* manage users
* assign campaign access
* assign character access
* create users through server-only admin actions

GM

GM can:

* create campaigns
* otherwise follows normal campaign/character access rules

Campaign editor

Campaign editor can:

* view/edit campaign
* view all characters in the campaign
* edit all characters in the campaign
* create characters in the campaign
* assign character access within the campaign

Campaign player

Campaign player can:

* view the campaign
* create characters in the campaign
* view/edit only characters they created or were explicitly assigned to

Character editor

Character editor can:

* view/edit that specific character

Character viewer

Character viewer can:

* view that specific character only

⸻

Important Derived Rules

1. Creating a campaign automatically grants the creator campaign editor access.
2. Creating a character automatically grants the creator character editor access.
3. A campaign editor automatically has view/edit access to every character in that campaign, regardless of character-level assignments.
4. A campaign player does not automatically get access to all characters in the campaign.
5. Character-level access is additive. It grants access to that one character only.
6. Admin overrides everything.

⸻

Recommended Database Tables

1) profiles

Public app-facing user table linked to auth.users.

Suggested columns:

* id uuid primary key references auth.users(id) on delete cascade
* email text unique
* display_name text null
* is_admin boolean not null default false
* is_gm boolean not null default false
* created_at timestamptz not null default now()
* updated_at timestamptz not null default now()

Notes:

* Use this table for app logic and UI.
* Do not rely on direct client access to auth.users.

2) campaigns

Suggested columns:

* id uuid primary key default gen_random_uuid()
* name text not null
* description text null
* created_by uuid not null references profiles(id)
* created_at timestamptz not null default now()
* updated_at timestamptz not null default now()

3) campaign_user_access

Join table for campaign permissions.

Suggested columns:

* campaign_id uuid not null references campaigns(id) on delete cascade
* user_id uuid not null references profiles(id) on delete cascade
* role text not null check (role in ('player','editor'))
* granted_by uuid null references profiles(id)
* created_at timestamptz not null default now()
* updated_at timestamptz not null default now()
* primary key (campaign_id, user_id)

4) characters

Suggested columns:

* id uuid primary key default gen_random_uuid()
* campaign_id uuid not null references campaigns(id) on delete cascade
* name text not null
* created_by uuid not null references profiles(id)
* created_at timestamptz not null default now()
* updated_at timestamptz not null default now()
* plus existing character payload columns

5) character_user_access

Join table for character permissions.

Suggested columns:

* character_id uuid not null references characters(id) on delete cascade
* user_id uuid not null references profiles(id) on delete cascade
* role text not null check (role in ('viewer','editor'))
* granted_by uuid null references profiles(id)
* created_at timestamptz not null default now()
* updated_at timestamptz not null default now()
* primary key (character_id, user_id)

⸻

Permission Matrix

Campaign actions

View campaign

Allowed if:

* user is admin, or
* row exists in campaign_user_access

Edit campaign

Allowed if:

* user is admin, or
* user has editor in campaign_user_access

Create campaign

Allowed if:

* user is admin, or
* profiles.is_gm = true

Character actions

Create character in campaign

Allowed if:

* user is admin, or
* user has player or editor access to the campaign

View character

Allowed if:

* user is admin, or
* user is campaign editor for the character’s campaign, or
* user created the character, or
* user has explicit character access (viewer or editor)

Edit character

Allowed if:

* user is admin, or
* user is campaign editor for the character’s campaign, or
* user created the character, or
* user has explicit character access editor

Delete character

Recommended same as edit character for v1.

⸻

Recommended UX Rules

Campaign list

* show only campaigns the current user can access, unless admin
* show New Campaign only if user is GM or admin
* show campaign edit controls only for campaign editors/admin

Inside a campaign

For campaign players:

* show campaign details
* show New Character
* show only characters they created or were assigned to

For campaign editors:

* show all characters in the campaign
* show campaign edit/manage access actions
* show character assignment UI

Character editor assignment flow

* GM/editor creates character
* on save or from character settings, assign another user as character editor
* assigned player now sees and can edit that character

⸻

Server vs Client Responsibilities

Client-side

Use standard Supabase client with user session for:

* reading campaigns user can access
* reading characters user can access
* creating/updating allowed campaigns and characters
* reading current user’s profile

Server-side only

Use Vercel server routes/functions with service_role for:

* create user
* invite user (if used)
* list all users for admin screens (recommended server-mediated)
* admin-only updates to profiles.is_admin / profiles.is_gm
* admin-managed access assignment workflows if you want hard enforcement beyond RLS

Never expose service_role in the browser.

⸻

Environment Variables

Client-safe

* NEXT_PUBLIC_SUPABASE_URL
* NEXT_PUBLIC_SUPABASE_ANON_KEY

Server-only

* SUPABASE_SERVICE_ROLE_KEY

If using Next.js on Vercel, ensure server-only vars are never referenced from client bundles.

⸻

RLS Strategy

Enable RLS on all public tables involved in app data.

Tables that should have RLS enabled:

* profiles
* campaigns
* campaign_user_access
* characters
* character_user_access

High-level policy intent:

* users can read/update only their own profile unless admin
* users can read campaigns they have access to
* users can edit campaigns only if campaign editor or admin
* users can create characters only in campaigns they can access
* users can read/edit characters according to the matrix above
* users can read their own access rows
* only admins and campaign editors should manage relevant access rows

Implementation note:
Prefer helper SQL functions such as:

* is_admin(uid uuid)
* is_campaign_editor(uid uuid, campaign uuid)
* has_campaign_access(uid uuid, campaign uuid)
* can_view_character(uid uuid, character uuid)
* can_edit_character(uid uuid, character uuid)

This keeps RLS policies readable and maintainable.

⸻

Suggested Implementation Phases

Phase 1: schema foundation

* add profiles
* add created_by to campaigns and characters if missing
* add campaign_user_access
* add character_user_access
* backfill creator/editor access for existing data

Phase 2: RLS

* enable RLS on all relevant tables
* add helper SQL functions
* add read/write policies for campaigns and characters
* validate with multiple test users

Phase 3: client auth wiring

* require sign-in for app data
* load current user profile
* gate UI by role/access

Phase 4: access management UI

* admin user management screen
* campaign access management screen
* character access management screen

Phase 5: polish

* empty states
* error handling
* confirmation dialogs
* audit-friendly granted_by

⸻

Edge Cases To Decide Explicitly

1. Can a campaign editor remove their own editor access?
    * Recommendation: no, unless admin.
2. Can the last editor be removed from a campaign?
    * Recommendation: no, unless admin assigns another editor first.
3. If a user loses campaign access, should they still retain character access in that campaign?
    * Recommendation for simplicity: no. Campaign access is the front door. Remove campaign access and they should lose practical access to all characters in that campaign.
    * If needed, cleanup logic should remove character access rows when campaign access is removed.
4. Should campaign players be able to see other players listed on the campaign?
    * Recommendation: optional; default to no for simplicity.
5. Should delete be soft-delete?
    * Recommendation: maybe later. Hard delete is okay for v1 if confirmation exists.

⸻

Copilot Implementation Guidance

When generating code with Copilot, prefer prompts that specify:

* exact table names and role names
* exact permission matrix
* whether code is server-only or client-safe
* no placeholder auth assumptions
* no weakening of RLS

Ask Copilot to implement in this order:

1. SQL migrations
2. helper SQL functions
3. RLS policies
4. typed data access layer
5. UI gating
6. admin/access management screens

⸻

Prompt Template For Copilot

Use this pattern:

Implement the CB permissions feature using Supabase and Next.js.
Requirements:

* Global roles in profiles: is_admin, is_gm
* Campaign roles in campaign_user_access: player, editor
* Character roles in character_user_access: viewer, editor
* Campaign editors can edit the campaign and all characters in it
* Campaign players can view the campaign, create characters, and access only characters they created or were explicitly assigned
* Character creators automatically get editor
* Campaign creators automatically get campaign editor
* Admin can manage all users, campaigns, characters, and access assignments
* Use Row Level Security on all relevant tables
* Keep SUPABASE_SERVICE_ROLE_KEY in server-only code
    First, generate the SQL migration and helper SQL functions only. Do not change UI yet.

⸻

Notes For Future Expansion

Possible later features, not in v1:

* invitations by email
* transfer campaign ownership semantics (if ever needed)
* soft delete / restore
* audit log table
* per-campaign GM labels in UI
* sharing templates or public campaigns