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

function validateBody(body) {
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  const temporaryPassword = typeof body?.temporaryPassword === "string" ? body.temporaryPassword : "";
  const isAdmin = Boolean(body?.isAdmin);
  const isGm = Boolean(body?.isGm);

  if (!email) return { error: "Email is required." };
  if (!displayName) return { error: "Display name is required." };
  if (!temporaryPassword || temporaryPassword.length < 8) {
    return { error: "Temporary password must be at least 8 characters." };
  }

  return {
    value: {
      email,
      displayName,
      temporaryPassword,
      isAdmin,
      isGm,
    },
  };
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

  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing authorization token." });
    return;
  }

  const validated = validateBody(req.body || {});
  if (validated.error) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const { email, displayName, temporaryPassword, isAdmin, isGm } = validated.value;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data: requesterData, error: requesterError } = await supabase.auth.getUser(token);
  if (requesterError || !requesterData?.user) {
    res.status(401).json({ error: "Invalid or expired session." });
    return;
  }

  const requesterId = requesterData.user.id;
  const { data: requesterProfile, error: requesterProfileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", requesterId)
    .maybeSingle();

  if (requesterProfileError) {
    res.status(500).json({ error: requesterProfileError.message });
    return;
  }

  if (!requesterProfile?.is_admin) {
    res.status(403).json({ error: "Only admins can add players." });
    return;
  }

  const { data: createData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  });

  if (createError || !createData?.user) {
    const message = createError?.message || "Failed to create auth user.";
    res.status(400).json({ error: message });
    return;
  }

  const userId = createData.user.id;
  const { error: upsertError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      display_name: displayName,
      is_admin: isAdmin,
      is_gm: isGm,
    },
    { onConflict: "id" }
  );

  if (upsertError) {
    res.status(500).json({ error: upsertError.message });
    return;
  }

  res.status(200).json({
    message: `Player ${email} created successfully.`,
    userId,
  });
}
