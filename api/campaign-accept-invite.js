import { createClient } from "@supabase/supabase-js";

function firstEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value;
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

function normalizeToken(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeEmail(email) {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase();
}

function mapErrorStatus(errorCode) {
  if (errorCode === "invalid_token") return 404;
  if (errorCode === "expired") return 410;
  if (errorCode === "used") return 409;
  if (errorCode === "email_mismatch") return 403;
  return 400;
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

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({
      error: "Missing server environment configuration.",
      details: {
        missingSupabaseUrl: !supabaseUrl,
        missingServiceRoleKey: !serviceRoleKey,
      },
    });
    return;
  }

  const authToken = readBearerToken(req);
  if (!authToken) {
    res.status(401).json({ error: "Missing authorization token." });
    return;
  }

  const inviteToken = normalizeToken(req.body?.token);
  if (!inviteToken) {
    res.status(400).json({ error: "Invite token is required.", errorCode: "invalid_token" });
    return;
  }

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
  const requesterEmail = normalizeEmail(requesterData.user.email);

  const { data: invite, error: inviteError } = await supabase
    .from("campaign_invites")
    .select("id, token, campaign_id, email, role, expires_at, used_at")
    .eq("token", inviteToken)
    .maybeSingle();

  if (inviteError) {
    res.status(400).json({ error: inviteError.message });
    return;
  }

  if (!invite) {
    res.status(404).json({ error: "Invalid invite token.", errorCode: "invalid_token" });
    return;
  }

  const nowMs = Date.now();
  const expiryMs = Date.parse(invite.expires_at);
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) {
    res.status(410).json({ error: "Invite has expired.", errorCode: "expired" });
    return;
  }

  if (invite.used_at) {
    res.status(409).json({ error: "Invite has already been used.", errorCode: "used" });
    return;
  }

  const inviteEmail = normalizeEmail(invite.email);
  if (inviteEmail && inviteEmail !== requesterEmail) {
    res.status(403).json({ error: "Invite email does not match your account.", errorCode: "email_mismatch" });
    return;
  }

  const nowIso = new Date().toISOString();

  const { error: accessError } = await supabase.from("campaign_user_access").upsert(
    {
      campaign_id: invite.campaign_id,
      user_id: requesterId,
      role: invite.role,
      updated_at: nowIso,
    },
    { onConflict: "campaign_id,user_id" }
  );

  if (accessError) {
    res.status(400).json({ error: accessError.message });
    return;
  }

  const { data: usedRows, error: usedError } = await supabase
    .from("campaign_invites")
    .update({ used_at: nowIso })
    .eq("id", invite.id)
    .is("used_at", null)
    .select("id");

  if (usedError) {
    res.status(400).json({ error: usedError.message });
    return;
  }

  if (!usedRows || usedRows.length === 0) {
    const errorCode = "used";
    res.status(mapErrorStatus(errorCode)).json({
      error: "Invite has already been used.",
      errorCode,
    });
    return;
  }

  res.status(200).json({
    campaignId: invite.campaign_id,
    role: invite.role,
    accepted: true,
  });
}
