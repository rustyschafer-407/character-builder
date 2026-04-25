export type GuidanceRole = "player" | "gm" | "admin";
export type GuidancePlacement = "top" | "bottom" | "left" | "right";
export type GuidancePage = "main" | "admin" | "access" | "display" | "wizard";

export type GuideMode = "closed" | "tour" | "inline" | "emptyState";

export type GuideSession = {
  mode: GuideMode;
  tourId?: string;
  stepIndex: number;
  startedByUser: boolean;
};

export type GuidePermission =
  | "createCampaign"
  | "editCampaign"
  | "manageCampaignAccess"
  | "createCharacter"
  | "viewCharacter"
  | "exportRoll20"
  | "openDisplay";

export interface GuideStep {
  id: string;
  tourId: string;
  title: string;
  body: string;
  target: string;
  page: GuidancePage;
  allowedRoles: GuidanceRole[];
  requiredPermission?: GuidePermission;
  placement?: GuidancePlacement;
}

export interface EmptyStateGuideCard {
  id: string;
  page: GuidancePage;
  title: string;
  body: string;
  primaryLabel: string;
  dismissLabel: string;
  allowedRoles: GuidanceRole[];
  requiredPermission?: GuidePermission;
}

export interface GuidanceContext {
  userRole: GuidanceRole;
  page: GuidancePage;
  permissions: Partial<Record<GuidePermission, boolean>>;
}

const KEY_EMPTY_DISMISSED = "cb.helpCoach.dismissedEmpty";
const KEY_TOURS_COMPLETED = "cb.helpCoach.completedTours";
const KEY_HELP_DISABLED = "cb.helpCoach.disabled";

function scopedKey(base: string, userId?: string | null): string {
  return userId ? `${base}.${userId}` : base;
}

function readStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function writeStringArray(key: string, values: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(values)));
  } catch {
    // ignore storage failures
  }
}

export function readDismissedEmptyStateIds(userId?: string | null): Set<string> {
  return new Set(readStringArray(scopedKey(KEY_EMPTY_DISMISSED, userId)));
}

export function writeDismissedEmptyStateIds(ids: Set<string>, userId?: string | null): void {
  writeStringArray(scopedKey(KEY_EMPTY_DISMISSED, userId), ids);
}

export function readCompletedTourIds(userId?: string | null): Set<string> {
  return new Set(readStringArray(scopedKey(KEY_TOURS_COMPLETED, userId)));
}

export function writeCompletedTourIds(ids: Set<string>, userId?: string | null): void {
  writeStringArray(scopedKey(KEY_TOURS_COMPLETED, userId), ids);
}

export function readHelpDisabled(userId?: string | null): boolean {
  try {
    return localStorage.getItem(scopedKey(KEY_HELP_DISABLED, userId)) === "1";
  } catch {
    return false;
  }
}

export function writeHelpDisabled(disabled: boolean, userId?: string | null): void {
  try {
    localStorage.setItem(scopedKey(KEY_HELP_DISABLED, userId), disabled ? "1" : "0");
  } catch {
    // ignore storage failures
  }
}

export function resetHelpCoachState(userId?: string | null): void {
  try {
    localStorage.removeItem(scopedKey(KEY_EMPTY_DISMISSED, userId));
    localStorage.removeItem(scopedKey(KEY_TOURS_COMPLETED, userId));
    localStorage.removeItem(scopedKey(KEY_HELP_DISABLED, userId));
  } catch {
    // ignore storage failures
  }
}

export function getPrimaryRole(input: {
  isAdmin: boolean;
  isGm: boolean;
  selectedCampaignRole?: "player" | "editor" | null;
  campaignRoles?: Record<string, "player" | "editor">;
}): GuidanceRole {
  if (input.selectedCampaignRole === "player") return "player";
  if (input.isAdmin) return "admin";
  if (input.isGm) return "gm";
  if (input.selectedCampaignRole === "editor") return "gm";

  const hasEditor = Object.values(input.campaignRoles ?? {}).some((role) => role === "editor");
  if (hasEditor) return "gm";

  return "player";
}

export function hasPermission(
  permissions: Partial<Record<GuidePermission, boolean>>,
  permission?: GuidePermission
): boolean {
  if (!permission) return true;
  return Boolean(permissions[permission]);
}

export function getGuideTargetElement(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
}

function hasHiddenAncestor(el: HTMLElement): boolean {
  let current: HTMLElement | null = el;
  while (current) {
    if (current.getAttribute("aria-hidden") === "true") return true;
    if (current.hasAttribute("hidden")) return true;
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return true;
    current = current.parentElement;
  }
  return false;
}

export function isElementActiveAndVisible(el: HTMLElement): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (hasHiddenAncestor(el)) return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (parseFloat(style.opacity) === 0) return false;

  if ((el as HTMLButtonElement).disabled) return false;

  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  return true;
}

export function isStepValidForContext(step: GuideStep, ctx: GuidanceContext): boolean {
  if (step.page !== ctx.page) return false;
  if (!step.allowedRoles.includes(ctx.userRole)) return false;
  if (!hasPermission(ctx.permissions, step.requiredPermission)) return false;

  const target = getGuideTargetElement(step.target);
  if (!target) return false;
  return isElementActiveAndVisible(target);
}
