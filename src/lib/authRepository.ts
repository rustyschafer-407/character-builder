import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { ensureProfileExists } from "./cloudRepository"
import { getSupabaseClient } from "./supabaseClient"

export type AuthListener = (event: AuthChangeEvent, session: Session | null) => void

export interface LoginPickerProfile {
  id: string
  label: string
}

export async function signInWithGoogle() {
  const supabase = getSupabaseClient()
  const redirectTo = typeof window === "undefined" ? undefined : window.location.href
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  })
  if (error) throw error
  return data
}

export async function requestEmailSignIn(email: string, password: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function requestPasswordReset(email: string) {
  const supabase = getSupabaseClient()
  const redirectTo =
    typeof window === "undefined" ? undefined : `${window.location.origin}/update-password`
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    // Ensure /update-password is listed in Supabase Auth redirect URLs.
    redirectTo,
  })
  if (error) throw error
  return data
}

export async function updateCurrentUserPassword(newPassword: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
  return data
}

export async function listLoginPickerProfiles(includeAdmin = false): Promise<LoginPickerProfile[]> {
  const supabase = getSupabaseClient()
  const rpcClient = supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }
  const { data, error } = await rpcClient.rpc("list_login_picker_profiles", {
    p_include_admin: includeAdmin,
  })
  if (error) throw error

  return ((data ?? []) as Array<{ profile_id: string; display_label: string | null }>)
    .map((row) => ({
      id: row.profile_id,
      label: (row.display_label ?? "").trim(),
    }))
    .filter((row) => row.id && row.label.length > 0)
}

export async function resolveLoginPickerEmail(profileId: string, includeAdmin = false): Promise<string> {
  const trimmedProfileId = profileId.trim()
  if (!trimmedProfileId) {
    throw new Error("Select a user")
  }

  const supabase = getSupabaseClient()
  const rpcClient = supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
  }
  const { data, error } = await rpcClient.rpc("resolve_login_profile_email", {
    p_profile_id: trimmedProfileId,
    p_include_admin: includeAdmin,
  })
  if (error) throw error

  const email = typeof data === "string" ? data.trim() : ""
  if (!email) {
    throw new Error("Unable to resolve login for selected user")
  }

  return email
}

export async function verifyEmailSignIn(email: string, token: string) {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentSession() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function syncProfileFromAuth() {
  return ensureProfileExists()
}

export function onAuthStateChange(listener: AuthListener) {
  const supabase = getSupabaseClient()
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    listener(event, session)
  })
  return () => {
    data.subscription.unsubscribe()
  }
}

export function getSessionUser(session: Session | null): User | null {
  return session?.user ?? null
}
