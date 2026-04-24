#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getSupabaseUrl() {
  const direct = process.env.SUPABASE_URL?.trim();
  const vite = process.env.VITE_SUPABASE_URL?.trim();
  const value = direct || vite;
  if (!value) {
    throw new Error("Missing SUPABASE_URL (or fallback VITE_SUPABASE_URL)");
  }
  return value;
}

function parseBooleanEnv(name) {
  const value = requireEnv(name).toLowerCase();
  if (value !== "true" && value !== "false") {
    throw new Error(`${name} must be 'true' or 'false'`);
  }
  return value === "true";
}

async function findUserByEmail(adminClient, email) {
  let page = 1;
  const perPage = 200;
  const target = email.toLowerCase();

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users ?? [];
    const found = users.find((user) => (user.email ?? "").toLowerCase() === target);
    if (found) return found;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const email = requireEnv("TARGET_USER_EMAIL").toLowerCase();
  const isAdmin = parseBooleanEnv("SET_IS_ADMIN");
  const isGm = parseBooleanEnv("SET_IS_GM");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const user = await findUserByEmail(adminClient, email);
  if (!user) {
    throw new Error(`No auth user found for email: ${email}`);
  }

  const { data, error } = await adminClient
    .from("profiles")
    .update({
      is_admin: isAdmin,
      is_gm: isGm,
    })
    .eq("id", user.id)
    .select("id, email, is_admin, is_gm")
    .single();

  if (error) throw error;

  console.log("Updated global roles");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error("Failed to set user global roles");
  console.error(error);
  process.exit(1);
});
