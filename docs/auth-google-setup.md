# Google OAuth Setup for Character Builder

This guide walks through setting up Google OAuth for Character Builder using Supabase. OAuth provides a seamless player login experience without requiring password management.

## Prerequisites

- Active Google Cloud project
- Active Supabase project
- Vercel project linked to the Character Builder GitHub repo
- Local development environment with `git` and `npm` installed

## Part 1: Google Cloud Console Setup

### Step 1: Create OAuth 2.0 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ Create Credentials** > **OAuth client ID**
   - If prompted to configure the OAuth consent screen first, click **Configure Consent Screen**
   - Choose **External** user type
   - Fill in required fields: app name, user support email, developer contact
   - Add `userinfo.email` and `userinfo.profile` scopes
   - Save and return to Credentials

### Step 2: Configure OAuth 2.0 Client ID

1. In **Credentials**, click **+ Create Credentials** > **OAuth client ID** (if not already created)
2. Select application type: **Web application**
3. Name the client (e.g., "Character Builder Dev" or "Character Builder Prod")
4. In **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (local dev, Vite default)
   - `https://localhost:3000` (if using alternate local port)
   - `https://your-app.vercel.app` (Vercel preview/production domain)
   - Example production domain: `https://character-builder.yourcompany.com`

5. In **Authorized redirect URIs**, add:
   - Your Supabase project's OAuth callback URL (see Part 2, Step 2 for exact URL)
   - Format: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
   - Example: `https://abcdef123456.supabase.co/auth/v1/callback`
   - Use the exact callback URL shown in `Supabase -> Authentication -> Providers -> Google`

6. Click **Create**
7. Copy and securely store:
   - **Client ID**
   - **Client Secret** (download as JSON or copy the secret value)

## Part 2: Supabase Configuration

### Step 1: Locate Your Supabase Project URL

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your Character Builder project
3. Click **Settings** > **API**
4. Note your **Project URL** (format: `https://[project-id].supabase.co`)

### Step 2: Enable Google OAuth Provider

1. In Supabase Dashboard, go to **Authentication** > **Providers**
2. Find and click **Google**
3. Toggle **Enable Google** to ON
4. Paste your Google OAuth credentials:
   - **Client ID**: from Google Cloud Console
   - **Client Secret**: from Google Cloud Console
5. Ensure **Enabled** is toggled ON
6. Click **Save**

### Step 3: Configure Site URL and Redirect URLs

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**
2. Set **Site URL** to your app's public origin:
   - Local dev: `http://localhost:5173`
   - Production: `https://character-builder.yourcompany.com` (your actual domain)
3. Under **Redirect URLs**, add:
   - `http://localhost:5173/auth/callback` (local dev)
   - `http://localhost:5173` (local fallback)
   - `https://your-app.vercel.app/auth/callback` (Vercel preview/prod)
   - `https://your-app.vercel.app` (Vercel fallback)
   - `https://character-builder.yourcompany.com/auth/callback` (production custom domain, if applicable)
   - `https://character-builder.yourcompany.com` (production custom domain fallback)
4. Click **Save**

### Step 4: Production-specific OAuth checks

Before production cutover, confirm:

1. Google provider is enabled in production Supabase
2. Production Google Client ID/Secret are set in production Supabase
3. Google OAuth redirect URI list contains the Supabase callback URL for the production Supabase project
4. Production app domain is set in Supabase URL Configuration (`Site URL` and `Redirect URLs`)
5. If Google consent screen is in Testing mode, production tester/admin accounts are listed as Test users

Note: Supabase's `detectSessionInUrl: true` flag (configured in `src/lib/supabaseClient.ts`) automatically handles OAuth callbacks to these URLs.

## Part 3: Vercel Environment Configuration

### Step 1: Set Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/)
2. Select your Character Builder project
3. Click **Settings** > **Environment Variables**
4. Verify or add the following variables:

   **For all environments (Development, Preview, Production):**
   - `VITE_SUPABASE_URL`: Your Supabase project URL
     - Example: `https://abcdef123456.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anonymous key
     - Found in Supabase Dashboard > Settings > API > `anon` key

   **Server-only variables (Production only, if using server functions):**
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
     - Found in Supabase Dashboard > Settings > API > `service_role` key
     - **CRITICAL**: Never expose this in client bundles or publicly accessible code

### Step 2: Verify .gitignore

Ensure sensitive files are excluded from version control:

```
.env
.env.local
.env.*.local
.supabase/
```

Never commit real Supabase keys, Google OAuth secrets, or any credentials to GitHub.

## Part 4: Local Development Testing

### Step 1: Set Up Local Environment

1. Create `.env.local` in the project root:

```
# Supabase (from Project Settings > API)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Only needed if using server-side bootstrap (admin script)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

2. Install dependencies and start local dev server:

```bash
npm install
npm run dev
```

3. Open `http://localhost:5173` in your browser

### Step 2: Test Google OAuth Locally

1. On the login screen, click **Sign in with Google**
2. You'll be redirected to Google's sign-in page
3. Sign in with a test Google account
4. After authentication, you should be redirected back to the app
5. A `profiles` row should be automatically created with:
   - `id`: matching your Google account's UUID
   - `email`: your Google account email
   - `display_name`: your Google account full name (if available)
   - `is_admin`: false
   - `is_gm`: false

### Step 3: Test "No Campaign Access" State

1. After successful OAuth sign-in:
   - You should see a friendly message: "You don't have access to any campaigns yet. Ask your GM to add you to a campaign."
2. Verify you cannot access campaigns or characters
3. Verify you cannot create campaigns (only GMs and admins can)

### Step 4: Test Email/Password Fallback (Optional)

If email/password fallback is enabled in the UI:

1. Click **Sign in with Email**
2. Enter a valid email and password
3. Session should establish
4. Same no-access state should appear (unless this account already has campaign membership)

## Part 5: Staging/Preview Testing on Vercel

### Step 1: Deploy to Vercel Preview

1. Push a feature branch to GitHub:

```bash
git push origin my-feature:my-feature
```

2. Vercel automatically creates a preview deployment
3. Vercel will display the preview URL (e.g., `https://character-builder-git-my-feature-yourteam.vercel.app`)

### Step 2: Test Google OAuth on Preview

1. Open the preview URL in your browser
2. Click **Sign in with Google**
3. Sign in with your test Google account
4. You should be redirected back to the preview URL with an active session
5. Verify profile row is created (backend > Supabase > Table Editor > `profiles`)
6. Verify "no campaign access" message appears

### Step 3: Grant Test Campaign Access (Optional)

To test with campaign membership:

1. In Supabase Dashboard, manually insert a row into `campaign_user_access`:
   - `campaign_id`: UUID of an existing test campaign
   - `user_id`: UUID from `profiles` (your Google OAuth user ID)
   - `role`: "player" or "editor"

2. Refresh the preview app
3. You should now see the assigned campaign in your campaign list
4. Verify you can view and interact with the campaign according to your assigned role

## Part 6: Production Deployment Testing

### Step 1: Merge to Main and Deploy

1. Create a pull request with your OAuth implementation
2. After code review and merge to `main`, Vercel automatically deploys to production
3. Monitor deployment status in Vercel Dashboard

### Step 2: Smoke Test Production

1. Navigate to your production app domain
2. Click **Sign in with Google**
3. Sign in with a test Google account
4. Verify:
   - Successful authentication and redirect
   - Profile row appears in Supabase (may have a brief delay)
   - "No campaign access" message displays for new users
   - Admin/GM users can create campaigns and manage access

### Step 3: Admin Bootstrap Smoke Test

If using the email/password admin bootstrap script:

1. Verify the bootstrap admin account can sign in with email/password
2. Verify bootstrap admin sees `is_admin=true` and `is_gm=true` in their profile
3. Verify bootstrap admin can:
   - View all campaigns (even without explicit access rows)
   - Edit campaigns and characters
   - Manage user access via the Admin panel

## Troubleshooting

### "OAuth client ID is required" / OAuth sign-in fails

**Cause:** Google OAuth provider is not configured or enabled in Supabase.

**Solution:**
1. Verify Google provider is toggled ON in Supabase > Authentication > Providers > Google
2. Verify Client ID and Client Secret are correct (no extra spaces)
3. Check browser console for detailed error messages
4. Clear browser cache and local storage: `localStorage.clear()`

### Redirect URI mismatch error

**Cause:** The OAuth callback URL doesn't match what's configured in Google Cloud Console.

**Solution:**
1. In Google Cloud Console > Credentials, verify the authorized redirect URI exactly matches your Supabase project's callback URL
2. In Supabase > Authentication > URL Configuration, verify redirect URLs include all environments
3. Format should be: `https://[project-id].supabase.co/auth/v1/callback?provider=google`
4. Re-check for typos and ensure HTTPS (not HTTP) for production

### "Invalid Site URL" / redirect loop

**Cause:** Site URL in Supabase doesn't match your app's actual origin.

**Solution:**
1. For local dev: Set Site URL to `http://localhost:5173`
2. For production: Set Site URL to your app's actual domain (the user immediately sees after login)
3. Ensure redirect URLs include the full origin (with scheme and port if non-standard)

### Profile row not created after OAuth sign-in

**Cause:** Auto-profile-creation logic not implemented in `src/App.tsx` or a Supabase trigger.

**Solution:**
1. Update `src/App.tsx` to check if `profiles` row exists after OAuth completion
2. If not, insert a new row with `display_name` from OAuth metadata (Google provides `full_name` claim)
3. Or: Create a Supabase trigger on `auth.users` insert that automatically creates a `profiles` row

### Session not persisting after refresh

**Cause:** `persistSession: true` not set in Supabase client or browser storage is disabled.

**Solution:**
1. Verify `supabaseClient.ts` has:
   ```typescript
   persistSession: true,
   autoRefreshToken: true,
   ```
2. Ensure browser allows localStorage (not disabled in privacy mode)
3. Check browser console for storage errors

## Testing Checklist

- [ ] Local dev: Google OAuth sign-in works and profile is created
- [ ] Local dev: Session persists after browser refresh
- [ ] Local dev: New user (no campaign access) sees friendly no-access message
- [ ] Local dev: Email/password fallback works (if enabled)
- [ ] Vercel preview: Google OAuth sign-in works with preview URL
- [ ] Vercel preview: Redirect back to preview domain succeeds
- [ ] Vercel production: Google OAuth sign-in works with production domain
- [ ] Vercel production: Profile creation confirmed in Supabase
- [ ] Demo: Assign test user to campaign, verify they see campaign on next login
- [ ] Demo: Admin bootstrap account can sign in with email/password
- [ ] Demo: Admin sees all users and can manage access
- [ ] Security: No Google OAuth secret exposed in client bundle
- [ ] Security: Service role key confirmed server-only in Vercel (if used)

## Next Steps

1. **Auto-profile creation:** Ensure `src/App.tsx` creates `profiles` row if missing after OAuth completion
2. **Admin bootstrap:** Deploy and test the admin bootstrap script (`scripts/bootstrap-admin.mjs`) if not already done
3. **Email/password fallback:** If using, add UI toggle between Google OAuth and email sign-in
4. **User onboarding:** After OAuth sign-in, prompt new users to set their display name and contact info
5. **Access management:** Implement GM-friendly UI for granting campaign/character access

## References

- [Supabase OAuth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud OAuth 2.0 Setup](https://support.google.com/cloud/answer/6158849)
- [Supabase Auth Session Detection](https://supabase.com/docs/reference/javascript/initializing#detect-session-in-url)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
