# Character Builder Permissions: Project Source of Truth

This document defines how authentication, global roles, campaign roles, character access, and UI permissions should work across Character Builder.

This is the intended product behavior. If existing code differs, refactor toward this model.

## Core Concepts

Character Builder has four permission layers:

1. Authentication
   - A user must be signed in to use cloud-backed production data.
   - Each authenticated user has a Supabase auth.users record.
   - Each authenticated user must also have a matching profiles row.
   - profiles.id must match auth.users.id.
   - profiles.email and profiles.display_name should be populated whenever possible.

2. Global Account Role
   - Stored on the user profile.
   - Determines app-wide administrative powers.
   - Examples:
     - Admin
     - Global GM / trusted builder, if still supported
     - Regular user / player

3. Campaign Membership Role
   - Stored per campaign.
   - Determines what a user can do inside a campaign.
   - Examples:
     - Campaign GM
     - Campaign Player
   - Campaign access may grant inherited access to characters within that campaign.

4. Direct Character Access
   - Stored per character.
   - Grants a user access to a specific character.
   - Examples:
     - Can view
     - Can edit
   - Direct character access can exist even if the user is not a campaign GM.

## General Rules

- Admins can manage everything.
- Campaign GMs can manage the campaigns where they are assigned as GM.
- Players can access only characters explicitly assigned to them or visible through the character maintenance screen.
- Character-specific access should override or supplement campaign-level access.
- Inherited campaign access should be clearly labeled as inherited and should not be confused with direct character access.
- No visible UI should ever show raw Supabase UUIDs as a user name or email.
- Permission checks must be enforced in data access / repository / RLS, not only hidden in the UI.

## Profile / User Display Rules

Every access row that references a user_id must resolve that user's profile.

Visible display rules:

- Display Name column:
  - Use profiles.display_name if present.
  - Else use the email prefix.
  - Else show "Unknown user."
  - Never show raw UUIDs.

- Email column:
  - Use profiles.email if present.
  - Else show "No email on profile."
  - Never show raw UUIDs.

The app should have one centralized profile-resolution path used by:
- Campaign Members table
- Character Access & Permissions table
- Collapsed Accounts & Permissions summary
- Add Player / Add Member dialogs where applicable

## Admin Role

Admins can:

- View all campaigns.
- Create campaigns.
- Edit any campaign.
- Delete campaigns, if delete exists.
- View all characters.
- Create characters in any campaign.
- Edit all characters.
- Delete characters, if delete exists.
- Change character type: PC / NPC.
- Copy any character to Roll20.
- Level up any character.
- Open Access / Permissions.
- View all people/accounts.
- Create or invite users.
- Set or reset user passwords, if supported.
- Assign global roles.
- Add/remove campaign members.
- Change campaign member roles.
- Add/remove direct character access.
- Change direct character permissions.
- See real display names/emails for all access rows.

## Campaign GM Role

A Campaign GM is assigned to a specific campaign.

Campaign GMs can:

- View campaigns where they are a GM.
- Edit campaign configuration for campaigns where they are GM, if they created it.
- View all characters in that campaign.
- Create characters in that campaign.
- Edit characters in that campaign.
- Create NPCs in that campaign.
- Create PCs for players.
- Copy campaign characters to Roll20.
- Level up characters in that campaign.
- View campaign members for a character via the character management page.
- Add campaign members to a character, if campaign GM management is allowed.
- Remove campaign members, if campaign GM management is allowed.
- Change campaign member role between Player and GM, if campaign GM management is allowed.
- Manage direct character access for characters in that campaign.
- See real display names/emails for users attached to that campaign and its characters.

Campaign GMs should not:

- Edit unrelated campaigns.
- Manage global users outside the context of their campaign.
- Assign global admin rights.
- See all profiles globally.
- See raw UUIDs in place of names/emails.

## Important GM Profile Visibility Rule

A non-admin Campaign GM must be able to resolve profile display data for:

- Users assigned to the same campaign through campaign_user_access.
- Users assigned directly to characters in that campaign through character_user_access.
- Users who appear as inherited campaign access rows on characters in that campaign.

This may require a secure RPC or RLS policy. Do not make all profiles public.

## Campaign Player Role

A Campaign Player is assigned to a campaign but is not a GM.

Campaign Players can:

- View their own assigned characters.
- Edit their own assigned characters only if they have direct character edit permission or campaign rules allow it.
- Copy their assigned character to Roll20, if allowed.
- Level up their assigned character.

Campaign Players should not:

- View or Edit campaign settings.
- View all characters unless explicitly allowed.
- Edit other players' characters unless explicitly allowed.
- Manage campaign members.
- Manage character access.
- View global account management.
- See unrelated user profile data.

## Direct Character Access

Direct character access is character-specific.

Supported permission levels:

- Can view
  - User can open/read the character.
  - User cannot modify the character.
  - User can copy to Roll20.

- Can edit
  - User can open and modify the character.
  - User can copy to Roll20.
  - User may level up the character.

Direct character access should be displayed in the Character Access & Permissions table with Source = Direct.

## Inherited Campaign Access

Inherited access comes from campaign membership.

Examples:

- A Campaign GM has inherited access to all characters in that campaign.
- A Campaign Player may have inherited campaign visibility, depending on product rules.
- Inherited rows should appear in character permissions for clarity, but they should not be editable as if they were direct character rows.

Inherited rows should:

- Show real display name and email.
- Show Source = Inherited · Campaign.
- Show the inherited role, such as Game Master.
- Not have a delete/remove direct-access button unless the action clearly edits campaign membership.
- Not show raw UUIDs.

## Character Access & Permissions Panel

The expanded character permissions panel should show both:

1. Direct character access rows
2. Inherited campaign access rows

Direct rows:
- Can have permission dropdowns.
- Can be removed from the character.
- Source = Direct.

Inherited rows:
- Should be read-only in the character panel.
- Should explain that access comes from campaign membership.
- Source = Inherited · Campaign.
- To remove inherited access, user must change campaign membership, not character access.

## Collapsed Accounts & Permissions Summary

The collapsed summary must use the same enriched data source as the expanded table.

It should show a short readable summary like:

- RussellT (rustyschafer@yahoo.com), Rusty (rustyschafer@me.com), rustyschafer (rustyschafer@gmail.com), ...

It must not show:

- raw UUIDs
- mixed UUID/name strings
- unknown users if the expanded panel has resolved names
- stale data from an older access path

## Campaign Members Page

Campaign Members page shows users with campaign-level access.

Columns:

- Display Name
- Email
- Role
- Actions

Roles:

- GM
- Player

Admin behavior:
- Can see and manage all campaign members.

Campaign GM behavior:
- Can see real names/emails for campaign members in their campaigns.
- Can manage campaign members only if campaign GM management is allowed.

Player behavior:
- Usually should not access this page.

## People / Account Management Page

This is global user management.

Admins can:

- View people.
- Create users/invites.
- Manage global roles.
- Reset passwords.
- Possibly deactivate users.

Non-admins should not have broad access to this page.

## Add Member / Add Player Behavior

Add Member:
- Adds a user to a campaign.
- Creates campaign_user_access row.
- Requires Admin or allowed Campaign GM.

Add Player:
- Requires Admin or allowed Campaign GM.
- Should allow selecting from users visible to the current manager.
- For Campaign GMs, the candidate list should include reasonable users in that campaign or users they are allowed to assign.
- It should not expose every global profile unless the user is Admin.

## Data Integrity Requirements

Every auth user referenced by access tables should have a profile row.

Access tables that reference users:

- campaign_user_access.user_id
- character_user_access.user_id
- granted_by fields, if present
- created_by fields, if present

Migration/backfill should ensure:

- Missing profiles are created for referenced auth users.
- Missing profile.email is backfilled from auth.users.email.
- Missing profile.display_name is backfilled from:
  1. auth metadata full_name
  2. auth metadata name
  3. email prefix
  4. final fallback only if necessary

## Security / RLS Requirements

Do not solve display issues by making profiles globally readable to everyone.

Correct behavior:

- Admin can read all needed profiles.
- Campaign GM can read profiles for users connected to their campaigns and characters.
- Player can read only profiles needed for their own visible character/campaign experience.
- Unauthenticated users cannot read profile data.
- Users should not be able to escalate their own roles.
- Users should not be able to grant themselves campaign or character access.
- All write operations must be checked server-side or by RLS.

## Recommended Profile Resolver

Use a centralized resolver:

Input:
- campaign_id
- optional character_id
- direct character access rows
- inherited campaign access rows

Process:
1. Collect distinct user_ids.
2. Try normal profiles query for those ids.
3. If rows are missing due to RLS, use a secure RPC that returns visible access profiles only.
4. Merge profiles onto each access row.
5. Return enriched rows to UI.

Output row shape should include:

- user_id
- display_name
- email
- profile object, if useful
- role / permission
- source: Direct or Inherited Campaign
- editable/removable flags

## UI State Rules

The UI should not infer permissions from display text.

Each row should explicitly know:

- Is this direct or inherited?
- Can current user edit this row?
- Can current user remove this row?
- Can current user change this role?
- Is the profile resolved?

## Acceptance Criteria

Admin:
- Sees all campaigns and characters.
- Access tables show real names/emails.
- Campaign Members page shows real names/emails.
- Can manage campaign and character access.

Campaign GM:
- Sees assigned campaigns.
- Sees characters in that campaign.
- Character Access & Permissions shows real names/emails for direct and inherited users.
- Campaign Members shows real names/emails.
- Can manage only allowed campaign/character permissions.
- Does not see unrelated profiles.

Player:
- Sees only allowed characters/campaigns.
- Cannot manage permissions.
- Cannot see unrelated users.

Global:
- No UUID appears in visible User, Display Name, Email, or summary text.
- Unknown user appears only when profile truly cannot be resolved.
- Collapsed summary and expanded table always agree.
- Access behavior is enforced by data/RLS, not just hidden buttons.
- npm run build passes.
- Gets pushed to staging so it can be tested before going to production.
