// Guidance system types and persistence helpers.

export type GuidanceRole = "player" | "gm" | "admin" | "any";
export type GuidancePlacement = "top" | "bottom" | "left" | "right";

export interface GuideCondition {
  hasNoCharacters?: boolean;
  hasCharacters?: boolean;
}

export interface GuideStep {
  id: string;
  /** Matches [data-guide="..."] on a DOM element */
  target: string;
  title: string;
  body: string;
  role?: GuidanceRole;
  placement?: GuidancePlacement;
  condition?: GuideCondition;
  /** Higher priority shown first */
  priority?: number;
}

// ---------------------------------------------------------------------------
// Persistence — user-specific keys fall back to a generic key when no userId
// ---------------------------------------------------------------------------

const BASE_KEY = "cb.guidance.dismissedSteps";

/** Returns the storage key to use for the given user, or the shared key. */
function storageKey(userId?: string | null): string {
  return userId ? `${BASE_KEY}.${userId}` : BASE_KEY;
}

export function readDismissedSteps(userId?: string | null): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    // ignore parse/storage errors
  }
  return new Set();
}

export function writeDismissedSteps(
  dismissed: Set<string>,
  userId?: string | null
): void {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify(Array.from(dismissed))
    );
  } catch {
    // ignore storage errors
  }
}

export function resetAllDismissedSteps(userId?: string | null): void {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Element visibility
// ---------------------------------------------------------------------------

/**
 * Returns true if the element is rendered and interactive enough to highlight.
 * Rejects elements that are: display:none, visibility:hidden, zero-size,
 * disabled, or inside a collapsed/hidden ancestor.
 */
export function isElementActiveAndVisible(el: HTMLElement): boolean {
  // offsetParent is null for display:none (except position:fixed)
  const style = window.getComputedStyle(el);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (parseFloat(style.opacity) === 0) return false;

  // Disabled form elements should be skipped
  if ((el as HTMLButtonElement).disabled) return false;

  // Zero bounding box means the element isn't rendered (e.g. collapsed section)
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Step selection
// ---------------------------------------------------------------------------

export interface GuidanceContext {
  isAdmin: boolean;
  isGm: boolean;
  /** Roles per campaign: "player" | "editor" */
  campaignRoles: Record<string, "player" | "editor">;
  hasCharacters: boolean;
}

/** Determine which roles apply for the given context, in priority order. */
function effectiveRoles(ctx: GuidanceContext): GuidanceRole[] {
  if (ctx.isAdmin) return ["admin", "gm", "any"];
  if (ctx.isGm) return ["gm", "any"];
  const isPlayer = Object.values(ctx.campaignRoles).some(
    (r) => r === "player" || r === "editor"
  );
  if (isPlayer) return ["player", "any"];
  return ["any"];
}

export function pickNextStep(
  steps: GuideStep[],
  dismissed: Set<string>,
  ctx: GuidanceContext
): GuideStep | null {
  const roles = effectiveRoles(ctx);

  const candidates = steps.filter((step) => {
    if (dismissed.has(step.id)) return false;

    // Role filter
    const stepRole = step.role ?? "any";
    if (stepRole !== "any" && !roles.includes(stepRole)) return false;

    // Condition filter
    if (step.condition) {
      if (step.condition.hasNoCharacters && ctx.hasCharacters) return false;
      if (step.condition.hasCharacters && !ctx.hasCharacters) return false;
    }

    // Target element must exist AND be visible/active.
    // If an element is inside a collapsed section, disabled, or hidden, skip
    // the step — the picker will re-run when the DOM changes.
    const el = document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
    if (!el || !isElementActiveAndVisible(el)) return false;

    return true;
  });

  if (candidates.length === 0) return null;

  // Sort by priority descending; Array.sort is stable in modern engines.
  candidates.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return candidates[0] ?? null;
}
