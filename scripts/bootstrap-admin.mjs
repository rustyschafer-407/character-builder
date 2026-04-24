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
  const email = requireEnv("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = requireEnv("BOOTSTRAP_ADMIN_PASSWORD");
  const shouldUpdatePassword = process.env.BOOTSTRAP_UPDATE_PASSWORD === "true";

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log(`Bootstrap admin start for ${email}`);

  let user = await findUserByEmail(adminClient, email);

  if (!user) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log("Created auth user");
  } else {
    console.log("Auth user already exists");
    if (shouldUpdatePassword) {
      const { error } = await adminClient.auth.admin.updateUserById(user.id, {
        password,
      });
      if (error) throw error;
      console.log("Updated auth user password due to BOOTSTRAP_UPDATE_PASSWORD=true");
    } else {
      console.log("Left existing password unchanged");
    }
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      is_admin: true,
      is_gm: true,
    },
    { onConflict: "id" }
  );

  if (profileError) throw profileError;

  console.log("Profile upserted with is_admin=true and is_gm=true");
  console.log("Bootstrap admin complete");
}

main().catch((error) => {
  console.error("Bootstrap admin failed");
  console.error(error);
  process.exit(1);
});
