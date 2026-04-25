# Microsoft OAuth Setup for Character Builder

This guide covers adding Microsoft login to Character Builder using Supabase's Azure OAuth provider.

Player-facing login options should be:
- Continue with Google
- Continue with Microsoft

Email/password remains available for admin and fallback login.

## Prerequisites

- Active Microsoft Entra ID tenant and Azure portal access
- Active Supabase project
- Character Builder app running locally and/or deployed

## 1. Microsoft Entra ID Setup

### Step 1: Register a New Application

1. Go to [Microsoft Entra admin center](https://entra.microsoft.com/) (or Azure Portal).
2. Navigate to **Identity** > **Applications** > **App registrations**.
3. Click **New registration**.
4. Enter an app name (for example: "Character Builder").
5. For **Supported account types**, choose the option that includes personal Microsoft accounts when possible:
   - **Accounts in any organizational directory and personal Microsoft accounts**
6. Click **Register**.

### Step 2: Add Supabase Redirect URI

1. Open the newly registered app.
2. Go to **Authentication**.
3. Add a **Web** platform redirect URI:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
4. Save changes.

Use your real Supabase project ref in place of `<project-ref>`.

### Step 3: Create Client Secret

1. Go to **Certificates & secrets**.
2. Click **New client secret**.
3. Set description and expiry based on your security policy.
4. Click **Add**.
5. Copy and securely store:
   - **Application (client) ID** from app overview
   - **Client secret value** (copy immediately; it is only fully shown once)

Do not commit real IDs or secrets to source control.

## 2. Supabase Setup

### Step 1: Enable Azure/Microsoft Provider

1. Open Supabase Dashboard.
2. Go to **Authentication** > **Providers**.
3. Open **Azure** (Microsoft) provider settings.
4. Enable the provider.
5. Paste:
   - **Client ID** = Microsoft Application (client) ID
   - **Client Secret** = Microsoft client secret value
6. Save.

### Step 2: Verify URL Configuration

1. In Supabase, go to **Authentication** > **URL Configuration**.
2. Verify **Site URL** matches your app origin.
3. Verify **Redirect URLs** include your app callback/origin URLs for local and production environments.

## 3. Local Development Note

Use `localhost` for local redirect URLs when testing Microsoft login.

- Preferred: `http://localhost:5173`
- Avoid: `http://127.0.0.1:5173`

Azure redirect matching can treat these as different origins. Using `localhost` consistently avoids callback mismatch issues.

## 4. QA Checklist

- Microsoft login works locally.
- Microsoft login works in production.
- `profiles` row is created after first successful login.
- No-access state works for users with no campaign membership.
- Assigned player sees their assigned campaign.

## Security Notes

- Never commit real Microsoft or Supabase secrets.
- Bootstrap admin remains email/password.
- Permissions remain mapped to authenticated Supabase user id (`auth.users.id`) and `profiles.id`.
- Campaign/character permission logic is unchanged by adding Microsoft login.