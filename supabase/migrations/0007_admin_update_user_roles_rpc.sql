-- Admin-only user role update RPC for Access Management Save action.

CREATE OR REPLACE FUNCTION public.admin_update_user_roles(
  p_target_user_id uuid,
  p_is_admin boolean,
  p_is_gm boolean
)
RETURNS void AS $$
DECLARE
  requester_id uuid;
BEGIN
  requester_id := auth.uid();

  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin(requester_id) THEN
    RAISE EXCEPTION 'Only admins can update user roles';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user is required';
  END IF;

  IF p_target_user_id = requester_id AND p_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Admins cannot remove their own admin role';
  END IF;

  UPDATE public.profiles
  SET
    is_admin = COALESCE(p_is_admin, FALSE),
    is_gm = COALESCE(p_is_gm, FALSE),
    updated_at = now()
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.admin_update_user_roles(uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_roles(uuid, boolean, boolean) TO authenticated;
