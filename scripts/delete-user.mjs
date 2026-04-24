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
  const targetUserId = process.env.TARGET_USER_ID?.trim() || "";
  const targetUserEmail = process.env.TARGET_USER_EMAIL?.trim().toLowerCase() || "";

  if (!targetUserId && !targetUserEmail) {
    throw new Error("Set TARGET_USER_ID or TARGET_USER_EMAIL");
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  let user = null;
  if (targetUserId) {
    const { data, error } = await adminClient.auth.admin.getUserById(targetUserId);
    if (error) throw error;
    user = data.user ?? null;
  } else {
    user = await findUserByEmail(adminClient, targetUserEmail);
  }

  if (!user) {
    throw new Error("Target user not found");
  }

  // Ensure profile FK references do not block delete cascade.
  const { error: clearCampaignCreatedByError } = await adminClient
    .from("campaigns")
    .update({ created_by: null })
    .eq("created_by", user.id);
  if (clearCampaignCreatedByError) throw clearCampaignCreatedByError;

  const { error: clearCharacterCreatedByError } = await adminClient
    .from("characters")
    .update({ created_by: null })
    .eq("created_by", user.id);
  if (clearCharacterCreatedByError) throw clearCharacterCreatedByError;

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false);
  if (deleteError) throw deleteError;

  console.log(`Deleted user ${user.id} (${user.email ?? "no-email"})`);
}

main().catch((error) => {
  console.error("Delete user failed");
  console.error(error);
  process.exit(1);
});
