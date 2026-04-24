-- Admin-only one-click user deletion RPC for UI.
-- Deletes auth user and cascades profile/access rows.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_target_user_id uuid)
RETURNS void AS $$
DECLARE
  requester_id uuid;
BEGIN
  requester_id := auth.uid();

  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin(requester_id) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required';
  END IF;

  IF p_target_user_id = requester_id THEN
    RAISE EXCEPTION 'Admins cannot delete themselves';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_target_user_id
      AND u.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- Break nullable FK links that are not ON DELETE SET NULL.
  UPDATE public.campaigns
  SET created_by = NULL
  WHERE created_by = p_target_user_id;

  UPDATE public.characters
  SET created_by = NULL
  WHERE created_by = p_target_user_id;

  -- Deleting auth.users row cascades to public.profiles via FK,
  -- then cascades to access tables via profile FKs.
  DELETE FROM auth.users
  WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
