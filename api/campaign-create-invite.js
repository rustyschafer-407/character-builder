import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_EXPIRY_DAYS = 7;
const TOKEN_BYTE_LENGTH = 32;
const MAX_INSERT_RETRIES = 3;

function firstEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function normalizeAppUrl(value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, "");
  }
  return `https://${value}`.replace(/\/+$/, "");
}

function getAppUrl(req) {
  const configured = firstEnv(
    "APP_URL",
    "VITE_APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "SITE_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL"
  );
  if (configured) {
    return normalizeAppUrl(configured);
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host || typeof host !== "string") {
    return "";
  }
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function parseOptionalEmail(email) {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function validateBody(body) {
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId.trim() : "";
  const role = typeof body?.role === "string" ? body.role.trim() : "";
  const email = parseOptionalEmail(body?.email);

  if (!campaignId) {
    return { error: "campaignId is required." };
  }

  if (role !== "player" && role !== "editor") {
    return { error: "role must be either 'player' or 'editor'." };
  }

  return {
    value: {
      campaignId,
      role,
      email,
    },
  };
}

function createToken() {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}

function defaultExpiresAt() {
  const now = Date.now();
  const expiresAtMs = now + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return new Date(expiresAtMs).toISOString();
}

async function canCreateInvite({ supabase, requesterId, campaignId }) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", requesterId)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (profile?.is_admin) {
    return true;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("campaign_user_access")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", requesterId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  return membership?.role === "editor";
}

async function insertInvite({ supabase, campaignId, createdBy, role, email, expiresAt }) {
  for (let attempt = 0; attempt < MAX_INSERT_RETRIES; attempt += 1) {
    const token = createToken();
    const { data, error } = await supabase
      .from("campaign_invites")
      .insert({
        token,
        campaign_id: campaignId,
        email,
        role,
        created_by: createdBy,
        expires_at: expiresAt,
      })
      .select("id, token, campaign_id, email, role, created_by, expires_at, used_at, created_at")
      .single();

    if (!error) {
      return data;
    }

    const constraintName = typeof error.constraint === "string" ? error.constraint : "";
    const errorMessage = typeof error.message === "string" ? error.message : "";
    const isUniqueTokenConflict =
      error.code === "23505" &&
      (constraintName.includes("campaign_invites_token") || errorMessage.includes("campaign_invites_token"));
    if (isUniqueTokenConflict && attempt < MAX_INSERT_RETRIES - 1) {
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error("Failed to create invite token.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = firstEnv(
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_PROJECT_URL",
    "STAGING_SUPABASE_URL",
    "PRODUCTION_SUPABASE_URL"
  );
  const serviceRoleKey = firstEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SERVICE_ROLE_KEY",
    "VITE_SUPABASE_SERVICE_ROLE_KEY",
    "STAGING_SUPABASE_SERVICE_ROLE_KEY",
    "PRODUCTION_SUPABASE_SERVICE_ROLE_KEY"
  );
  const appUrl = getAppUrl(req);

  if (!supabaseUrl || !serviceRoleKey || !appUrl) {
    res.status(500).json({
      error: "Missing server environment configuration.",
      details: {
        missingSupabaseUrl: !supabaseUrl,
        missingServiceRoleKey: !serviceRoleKey,
        missingAppUrl: !appUrl,
      },
    });
    return;
  }

  const authToken = readBearerToken(req);
  if (!authToken) {
    res.status(401).json({ error: "Missing authorization token." });
    return;
  }

  const validated = validateBody(req.body || {});
  if (validated.error) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const { campaignId, role, email } = validated.value;
  const expiresAt = defaultExpiresAt();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data: requesterData, error: requesterError } = await supabase.auth.getUser(authToken);
  if (requesterError || !requesterData?.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }

  const requesterId = requesterData.user.id;

  try {
    const allowed = await canCreateInvite({
      supabase,
      requesterId,
      campaignId,
    });

    if (!allowed) {
      res.status(403).json({ error: "Only admins or campaign editors can create invites." });
      return;
    }

    const invite = await insertInvite({
      supabase,
      campaignId,
      createdBy: requesterId,
      role,
      email,
      expiresAt,
    });

    const inviteUrl = `${appUrl}/invite?token=${encodeURIComponent(invite.token)}`;

    res.status(200).json({
      invite,
      inviteUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create campaign invite.";
    res.status(400).json({ error: message });
  }
}