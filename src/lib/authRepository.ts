import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js"
import { getSupabaseClient } from "./supabaseClient"

export type AuthListener = (event: AuthChangeEvent, session: Session | null) => void

export async function requestEmailSignIn(email: string) {
  const supabase = getSupabaseClient()
  const emailRedirectTo = typeof window === "undefined" ? undefined : window.location.origin
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
      shouldCreateUser: true,
    },
  })
  if (error) throw error
  return data
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
