# Google OAuth & Permissions QA Test Plan

## Setup
- Deploy branch with Google OAuth + profile auto-create to Vercel staging
- Have Supabase staging project with migrations 0002-0005 applied
- Google OAuth provider enabled in Supabase with valid credentials
- Bootstrap admin account created via `npm run bootstrap:admin` (or equivalent)

---

## Test 1: Bootstrap Admin Email/Password Sign In

**Objective:** Verify existing email/password auth for admin still works

**Steps:**
1. Open app in private/incognito window to clear any cached session
2. At login screen, click "Sign In with Email Instead"
3. Enter bootstrap admin email and password
4. Submit form

**Expected Result:**
- ✓ Successfully authenticated
- ✓ Redirected to main app screen (not no-access state)
- ✓ Can see "New Campaign" button (indicator of admin/GM status)
- ✓ Browser console shows no auth errors

**Notes:**
- Bootstrap email/password should work without Google OAuth redirect

---

## Test 2: New Player Can Sign In With Google

**Objective:** Verify Google OAuth sign-in works for new users

**Setup:**
- Use a Google account that hasn't been used with the app before
- Email: `testplayer1@gmail.com` (or your test Google account)

**Steps:**
1. Open app in private/incognito window
2. At login screen, confirm "Continue with Google" is visible
3. Click "Continue with Google"
4. Redirected to Google sign-in
5. Sign in with test Google account
6. Approve app permissions (if prompted)
7. Redirected back to app

**Expected Result:**
- ✓ Successfully authenticated
- ✓ Session established with Google OAuth user
- ✓ No errors in browser console or Supabase logs
- ✓ User ID is from OAuth session (not email-based)

**Notes:**
- First-time OAuth should trigger profile creation via trigger

---

## Test 3: New Google Player Gets Correct Profile Row

**Objective:** Verify profile auto-creation with correct defaults

**Verification (via Supabase Dashboard):**
1. Go to Supabase Dashboard > SQL Editor
2. Run query:
   ```sql
   SELECT id, email, display_name, is_admin, is_gm, created_at 
   FROM public.profiles 
   WHERE email = 'testplayer1@gmail.com' 
   LIMIT 1;
   ```

**Expected Result:**
- ✓ Exactly one row returned
- ✓ `email` = `testplayer1@gmail.com`
- ✓ `display_name` NOT NULL (either Google full_name or email prefix)
- ✓ `is_admin` = false
- ✓ `is_gm` = false
- ✓ `created_at` is recent (within last minute)

**Notes:**
- If `display_name` is empty or error, check trigger in migration 0005
- If duplicate rows exist, ON CONFLICT clause isn't working

---

## Test 4: New Player With No Access Sees No-Access State

**Objective:** Verify friendly message for players with no campaign access

**Setup:**
- Continue as the Google player from Test 2
- This player should have no campaign access rows

**Expected Behavior:**
- ✓ Main app screen NOT shown
- ✓ Instead, see panel with:
  - "You're signed in, but you don't have access to any campaigns yet."
  - Display name and email shown
  - "Ask your GM to add you to a campaign."
  - "Sign Out" button

**Verification:**
```bash
# In browser DevTools, check state:
# - currentUserId: should be set
# - hasAnyCampaignAccess: should be false
# - isAdmin/isGm: should be false
```

**Notes:**
- Admins/GMs should NOT see this state (they see full app)

---

## Test 5: Admin Can Assign Player Campaign Role

**Objective:** Verify admin can grant campaign access by email

**Setup:**
- Sign out (use bootstrap admin account)
- Sign in as bootstrap admin via email/password
- Create a test campaign (or use existing one)
- Click "Security" button for that campaign

**Steps:**
1. In "Access Management" panel, go to "Campaign Access" section
2. Scroll to "Add by Email" subsection
3. Enter player email: `testplayer1@gmail.com`
4. Select role: "player"
5. Click "Add"

**Expected Result:**
- ✓ No error message
- ✓ Email field clears
- ✓ New row appears in campaign access list below
- ✓ Shows: `testplayer1@gmail.com | player | Remove`
- ✓ Browser console shows no errors

**Error Handling:**
- If player email not found: Show "Player with email 'X' not found. They must sign in with Google using this email first."

**Verification (Supabase):**
```sql
SELECT campaign_id, user_id, role, created_at 
FROM public.campaign_user_access 
WHERE user_id = (SELECT id FROM profiles WHERE email = 'testplayer1@gmail.com')
LIMIT 1;
```
- ✓ One row returned with role = `player`

---

## Test 6: Player Sees Assigned Campaign After Refresh

**Objective:** Verify player receives updated access after refresh

**Setup:**
- Continue as testplayer1 (or open new private window and sign in as testplayer1)

**Steps:**
1. If already signed in, refresh page (Cmd+R or F5)
2. Wait for auth to initialize (should not see login screen)
3. Observe main app screen

**Expected Result:**
- ✓ NOT in no-access state
- ✓ Main app screen visible
- ✓ Campaign dropdown shows the assigned campaign
- ✓ Campaign name matches what admin created
- ✓ Can see "New Character" button

**Verification:**
- Check DevTools: `hasAnyCampaignAccess` should be `true`

**Notes:**
- First load may take a moment for RLS policies to take effect

---

## Test 7: Player Can Create Character

**Objective:** Verify player can create character in assigned campaign

**Setup:**
- Continue as testplayer1 in assigned campaign

**Steps:**
1. Click "New Character"
2. Character Creation Wizard opens
3. Fill in character details (name, class, race, etc.)
4. Complete wizard and save character

**Expected Result:**
- ✓ Character created in database
- ✓ Character appears in sidebar
- ✓ Character is selectable and editable in workspace
- ✓ Character `created_by` = testplayer1's user ID
- ✓ No permission errors

**Verification (Supabase):**
```sql
SELECT id, campaign_id, name, created_by 
FROM public.characters 
WHERE created_by = (SELECT id FROM profiles WHERE email = 'testplayer1@gmail.com')
LIMIT 1;
```
- ✓ Row found for testplayer1's character

---

## Test 8: Player Cannot See Another Player's Character Unless Assigned

**Objective:** Verify RLS prevents unauthorized character access

**Setup:**
- Create a second test player: `testplayer2@gmail.com`
- Sign in as testplayer2, assign to same campaign
- testplayer2 creates a character
- Sign out, then sign in as testplayer1

**Steps:**
1. As testplayer1, check character list in sidebar
2. Testplayer2's character should NOT appear

**Expected Result:**
- ✓ Sidebar shows only testplayer1's characters
- ✓ Testplayer2's character is not visible
- ✓ If you try to access testplayer2's character directly (URL hack), get permission denied in UI

**Verification (database):**
- Character exists in DB for testplayer2
- But testplayer1 cannot read it via RLS

**Notes:**
- Character-level access can be granted separately later

---

## Test 9: Campaign Editor Can See/Edit All Characters

**Objective:** Verify campaign editors bypass character-level access checks

**Setup:**
- Sign in as bootstrap admin
- Add testplayer1 as "editor" to the campaign
- Sign in as testplayer1

**Steps:**
1. As testplayer1 (now editor), refresh page
2. Check character list in sidebar
3. Should see ALL characters created by any player in this campaign

**Expected Result:**
- ✓ Sidebar shows both testplayer1 and testplayer2's characters
- ✓ Can click on either character and edit
- ✓ Can delete other players' characters (with confirmation)
- ✓ Can assign character access to other players

**Verification:**
- Edit a character created by testplayer2
- Change a stat and save
- Verify change persists for testplayer2

**Notes:**
- Campaign editor role in `campaign_user_access` grants this automatically

---

## Test 10: Existing Email/Password User Can Sign In With Google (No Duplicate)

**Objective:** Verify same email can be used for email/password and OAuth without duplication

**Setup:**
- Create an email/password account: `sharedtest@example.com` (via admin bootstrap or manual auth)
- Sign in once with email/password to create profile
- Sign out

**Steps:**
1. Go to login screen
2. Click "Continue with Google"
3. Use Google account with email `sharedtest@example.com` as recovery email
4. Complete OAuth flow

**Expected Result:**
- ✓ Successfully authenticated as Google OAuth user
- ✓ Existing profile row reused (not duplicated)
- ✓ Same user ID used for both auth methods
- ✓ display_name potentially updated from Google full_name (optional)

**Verification (Supabase):**
```sql
SELECT COUNT(*) as profile_count 
FROM public.profiles 
WHERE email = 'sharedtest@example.com';
```
- ✓ Count = 1 (not 2)

**Notes:**
- This verifies `ON CONFLICT (id) DO NOTHING` in trigger
- Users can switch between email/password and Google using same email

---

## Test 11: service_role Not Imported in Client Code

**Objective:** Verify no service_role leaks to client bundles

**Steps:**
1. Search client code for "service_role":
   ```bash
   grep -r "service_role" src/
   ```

2. Check built bundle:
   ```bash
   npm run build
   grep -r "service_role" dist/
   ```

3. Check environment variable references:
   ```bash
   grep -r "SUPABASE_SERVICE_ROLE_KEY" src/
   ```

**Expected Result:**
- ✓ No matches in `src/` (client code)
- ✓ No matches in `dist/` (built bundle)
- ✓ `SUPABASE_SERVICE_ROLE_KEY` only in:
   - `scripts/` (server-only bootstrap)
   - Docs/comments
   - Not in client .tsx files

**Notes:**
- Only VITE_ prefixed variables are safe for client
- SUPABASE_SERVICE_ROLE_KEY is server-only, never referenced client-side

---

## Test 12 (Bonus): Admin/GM Not Blocked by No-Access State

**Objective:** Verify admins and GMs see app even with no direct campaign access

**Setup:**
- Create new test admin user (email/password)
- Mark as is_admin=true via server script
- OR: Create new test GM user (email/password)
- Mark as is_gm=true via server script
- Don't assign any campaign access rows

**Steps:**
1. Sign in as the new admin/GM
2. Observe main screen

**Expected Result:**
- ✓ NOT in no-access state
- ✓ Can see "New Campaign" button
- ✓ Can see all campaigns (admin) or can create new campaign (GM)
- ✓ Can access admin panel

**Notes:**
- Admins are global, bypass all RLS
- GMs can create campaigns even with no existing access

---

## Summary Checklist

- [ ] Test 1: Bootstrap admin email/password works
- [ ] Test 2: New player Google OAuth sign-in works
- [ ] Test 3: New player profile row correct (is_admin=false, is_gm=false)
- [ ] Test 4: New player no-access state shows friendly message
- [ ] Test 5: Admin can assign player by email
- [ ] Test 6: Player sees campaign after refresh
- [ ] Test 7: Player can create character
- [ ] Test 8: Player cannot see other players' characters
- [ ] Test 9: Campaign editor sees/edits all characters
- [ ] Test 10: Same email email/password + OAuth no duplicate
- [ ] Test 11: service_role not in client code
- [ ] Test 12 (Bonus): Admin/GM not blocked by no-access

---

## Regression Tests (Verify Existing Features Still Work)

- [ ] Non-cloud mode (Supabase disabled) still works
- [ ] Campaign creation works
- [ ] Character sheet displays and styles correct
- [ ] Exports still work (Roll20, etc)
- [ ] Admin user management works
- [ ] Campaign access management works
- [ ] Character access management works

---

## Notes for Testers

1. **Private/Incognito Windows:** Use for each test to avoid stale session caches
2. **Browser DevTools:** Check Console for errors and Network tab for failed requests
3. **Supabase Dashboard:** Monitor Auth > Users and Monitor > Database Logs during tests
4. **Email Domains:** Use consistent test emails (e.g., `@gmail.com` for Google, `@example.com` for manual)
5. **Timing:** OAuth callback may take 2-3 seconds; be patient at redirects
6. **Error Messages:** Should be user-friendly, not technical database errors

---

## Known Limitations (v1)

- No email verification for email/password fallback
- No user-invited-via-email pending state (emails must sign in first)
- No campaign invite links
- No two-factor auth

---

## Sign-Off

All tests completed: **[ ] Yes [ ] No**

Tester Name: ________________  
Date: ________________  
Issues Found: ________________
