-- Auto-create profiles row when a new auth user is created
-- This trigger ensures every authenticated user has a corresponding profiles row
-- Without requiring client-side service_role calls

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
DECLARE
  display_name_value text;
BEGIN
  -- Extract display_name from OAuth metadata with fallback chain
  -- Priority: full_name > name > email prefix
  display_name_value := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(NEW.email, '@', 1),
    'Player'
  );

  -- Insert profiles row for new auth user
  INSERT INTO public.profiles (id, email, display_name, is_admin, is_gm, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    display_name_value,
    false,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists (safe idempotent operation)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires on new auth user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Create function to safely sync profile display_name from auth metadata
-- This allows updating display_name without overwriting is_admin/is_gm
-- Called from client after OAuth login
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth()
RETURNS public.profiles AS $$
DECLARE
  auth_user auth.users;
  profile_row public.profiles;
  display_name_value text;
BEGIN
  -- Get current authenticated user
  auth_user := auth.jwt();
  
  IF auth_user.id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Extract display_name from OAuth metadata
  display_name_value := COALESCE(
    auth_user.raw_user_meta_data->>'full_name',
    auth_user.raw_user_meta_data->>'name',
    SPLIT_PART(auth_user.email, '@', 1),
    'Player'
  );

  -- Update profile display_name and email, but never overwrite is_admin/is_gm
  UPDATE public.profiles
  SET
    email = auth_user.email,
    display_name = display_name_value,
    updated_at = NOW()
  WHERE id = auth_user.id
  RETURNING * INTO profile_row;

  IF profile_row.id IS NULL THEN
    -- Profile doesn't exist, create it (belt and suspenders)
    INSERT INTO public.profiles (id, email, display_name, is_admin, is_gm, created_at, updated_at)
    VALUES (
      auth_user.id,
      auth_user.email,
      display_name_value,
      false,
      false,
      NOW(),
      NOW()
    )
    RETURNING * INTO profile_row;
  END IF;

  RETURN profile_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to authenticated users only
GRANT EXECUTE ON FUNCTION public.sync_profile_from_auth TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user TO postgres;
