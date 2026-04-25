import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const rememberMeStorageKey = "character-builder.rememberMe"
let supabaseClient: ReturnType<typeof createClient> | null = null
let rememberMePreference = readRememberMePreference()

function readRememberMePreference() {
  if (typeof window === "undefined") return true
  try {
    const stored = window.localStorage.getItem(rememberMeStorageKey)
    return stored !== "false"
  } catch {
    return true
  }
}

function getAuthStorage(rememberMe: boolean) {
  if (typeof window === "undefined") return undefined
  return rememberMe ? window.localStorage : window.sessionStorage
}

export function hasSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export function getSupabaseEnvStatus() {
  return {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
  }
}

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables")
  }

  if (supabaseClient) {
    return supabaseClient
  }

  const storage = getAuthStorage(rememberMePreference)

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage,
      storageKey: "character-builder-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return supabaseClient
}

export function getRememberMePreference() {
  return rememberMePreference
}

export function setRememberMePreference(rememberMe: boolean) {
  rememberMePreference = rememberMe
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(rememberMeStorageKey, String(rememberMe))
    } catch {
      // Ignore storage write failures; we'll fall back to default behavior.
    }
  }
  // Recreate client on next use so auth storage honors the new preference.
  supabaseClient = null
}
