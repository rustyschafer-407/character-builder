import { createClient } from "@supabase/supabase-js";

function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

function validateBody(body) {
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!userId) return { error: "User ID is required." };
  if (!newPassword) return { error: "New password is required." };
  if (newPassword.length < 1) {
    return { error: "Password cannot be empty." };
  }

  return {
    value: {
      userId,
      newPassword,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: "Missing server environment configuration." });
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

  const { userId, newPassword } = validated.value;

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
    res.status(403).json({ error: "Only admins can set user passwords." });
    return;
  }

  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (updateError) {
    const message = updateError?.message || "Failed to update password.";
    res.status(400).json({ error: message });
    return;
  }

  res.status(200).json({
    message: `Password updated successfully for user ${updateData?.user?.email || userId}.`,
  });
}
