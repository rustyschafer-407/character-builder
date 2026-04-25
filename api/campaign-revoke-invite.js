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

  const inviteId = typeof req.body?.inviteId === "string" ? req.body.inviteId.trim() : "";
  if (!inviteId) {
    res.status(400).json({ error: "inviteId is required." });
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

  const { data: invite, error: inviteError } = await supabase
    .from("campaign_invites")
    .select("id, campaign_id")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteError) {
    res.status(400).json({ error: inviteError.message });
    return;
  }

  if (!invite) {
    res.status(404).json({ error: "Invite not found." });
    return;
  }

  try {
    const allowed = await canManageCampaignInvites({
      supabase,
      requesterId: requesterData.user.id,
      campaignId: invite.campaign_id,
    });

    if (!allowed) {
      res.status(403).json({ error: "Only admins or campaign editors can revoke invites." });
      return;
    }

    const { error: deleteError } = await supabase
      .from("campaign_invites")
      .delete()
      .eq("id", inviteId);

    if (deleteError) {
      res.status(400).json({ error: deleteError.message });
      return;
    }

    res.status(200).json({ revoked: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke invite.";
    res.status(400).json({ error: message });
  }
}
