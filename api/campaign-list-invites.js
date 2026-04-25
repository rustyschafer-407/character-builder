import { createClient } from "@supabase/supabase-js";

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
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host && typeof host === "string") {
    const proto = req.headers["x-forwarded-proto"] || "https";
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  const configured = firstEnv(
    "APP_URL",
    "VITE_APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "SITE_URL",
    "VERCEL_URL",
    "VERCEL_PROJECT_PRODUCTION_URL"
  );
  if (configured) {
    return normalizeAppUrl(configured);
  }

  return "";
}

async function canManageCampaignInvites({ supabase, requesterId, campaignId }) {
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

export default async function handler(req, res) {
  if (req.method !== "GET") {
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

  const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId.trim() : "";
  if (!campaignId) {
    res.status(400).json({ error: "campaignId is required." });
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

  try {
    const allowed = await canManageCampaignInvites({
      supabase,
      requesterId: requesterData.user.id,
      campaignId,
    });

    if (!allowed) {
      res.status(403).json({ error: "Only admins or campaign editors can view invites." });
      return;
    }

    const { data, error } = await supabase
      .from("campaign_invites")
      .select("id, token, campaign_id, email, role, expires_at, used_at, created_at")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const invites = (data ?? []).map((row) => ({
      ...row,
      inviteUrl: `${appUrl}/invite?token=${encodeURIComponent(row.token)}`,
    }));

    res.status(200).json({ invites });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list invites.";
    res.status(400).json({ error: message });
  }
}
