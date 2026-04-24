type UserLike = {
  display_name?: string | null;
  email?: string | null;
  full_name?: string | null;
  name?: string | null;
  user_metadata?: Record<string, unknown> | null;
  raw_user_meta_data?: Record<string, unknown> | null;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getEmailPrefix(email: string | null): string | null {
  if (!email) return null;
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return null;
  const prefix = email.slice(0, atIndex).trim();
  return prefix.length > 0 ? prefix : null;
}

function getMetadataName(user: UserLike | null | undefined): string | null {
  if (!user) return null;

  const directFullName = asNonEmptyString(user.full_name);
  if (directFullName) return directFullName;

  const directName = asNonEmptyString(user.name);
  if (directName) return directName;

  const userMeta = user.user_metadata ?? null;
  const userMetaFullName = asNonEmptyString(userMeta?.full_name);
  if (userMetaFullName) return userMetaFullName;

  const userMetaName = asNonEmptyString(userMeta?.name);
  if (userMetaName) return userMetaName;

  const rawMeta = user.raw_user_meta_data ?? null;
  const rawMetaFullName = asNonEmptyString(rawMeta?.full_name);
  if (rawMetaFullName) return rawMetaFullName;

  const rawMetaName = asNonEmptyString(rawMeta?.name);
  if (rawMetaName) return rawMetaName;

  return null;
}

export function resolveUserName(user: UserLike | null | undefined, fallback: string): string {
  const displayName = asNonEmptyString(user?.display_name);
  if (displayName) return displayName;

  const metadataName = getMetadataName(user);
  if (metadataName) return metadataName;

  const email = asNonEmptyString(user?.email) ?? null;
  const emailPrefix = getEmailPrefix(email);
  if (emailPrefix) return emailPrefix;

  if (email) return email;

  const fallbackEmailPrefix = getEmailPrefix(fallback);
  if (fallbackEmailPrefix) return fallbackEmailPrefix;

  return fallback;
}

export function resolveUserEmail(user: UserLike | null | undefined, fallback: string): string {
  return asNonEmptyString(user?.email) ?? fallback;
}
