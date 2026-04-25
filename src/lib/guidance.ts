// Guidance system types and persistence helpers.

export type GuidanceRole = "player" | "gm" | "admin" | "any";
export type GuidancePlacement = "top" | "bottom" | "left" | "right";
export type GuidanceMode = "contextual" | "walkthrough";

export interface GuideCondition {
  hasNoCampaigns?: boolean;
  hasCampaigns?: boolean;
  hasNoCharacters?: boolean;
  hasCharacters?: boolean;
  hasNoCharactersInSelectedCampaign?: boolean;
  hasCharactersInSelectedCampaign?: boolean;
  hasSelectedCharacter?: boolean;
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
// Step selection and target validation
// ---------------------------------------------------------------------------

export interface GuidanceContext {
  isAdmin: boolean;
  isGm: boolean;
  /** Roles per campaign: "player" | "editor" */
  campaignRoles: Record<string, "player" | "editor">;
  selectedCampaignRole?: "player" | "editor" | null;
  hasCampaigns: boolean;
  hasCharacters: boolean;
  hasCharactersInSelectedCampaign: boolean;
  hasSelectedCharacter: boolean;
}

/** Determine which roles apply for the given context, in priority order. */
export function effectiveRoles(ctx: GuidanceContext): GuidanceRole[] {
  if (ctx.selectedCampaignRole === "player") {
    // Admins can act as players in a specific campaign; prefer player hints first.
    if (ctx.isAdmin) return ["player", "admin", "gm", "any"];
    return ["player", "any"];
  }

  if (ctx.selectedCampaignRole === "editor") {
    if (ctx.isAdmin) return ["admin", "gm", "player", "any"];
    if (ctx.isGm) return ["gm", "player", "any"];
  }

  if (ctx.isAdmin) return ["admin", "gm", "any"];
  if (ctx.isGm) return ["gm", "any"];

  const hasPlayerRole = Object.values(ctx.campaignRoles).some((r) => r === "player");
  const hasEditorRole = Object.values(ctx.campaignRoles).some((r) => r === "editor");
  if (hasPlayerRole) return ["player", "any"];
  if (hasEditorRole) return ["gm", "player", "any"];

  return ["any"];
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

function isCoveredByAnotherLayer(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return true;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const top = document.elementFromPoint(cx, cy) as HTMLElement | null;
  if (!top) return false;
  return !(top === el || el.contains(top) || top.contains(el));
}

/**
 * Returns true if the element is rendered and interactive enough to highlight.
 * Rejects elements that are: display:none, visibility:hidden, zero-size,
 * disabled, aria-hidden, covered by another layer, or inside hidden parents.
 */
export function isElementActiveAndVisible(el: HTMLElement): boolean {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (hasHiddenAncestor(el)) return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (parseFloat(style.opacity) === 0) return false;

  // Disabled form elements should be skipped
  if ((el as HTMLButtonElement).disabled) return false;

  // Zero bounding box means the element isn't rendered (e.g. collapsed section)
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;

  // Skip targets hidden behind another modal/overlay layer.
  if (isCoveredByAnotherLayer(el)) return false;

  return true;
}

function conditionMatches(step: GuideStep, ctx: GuidanceContext): boolean {
  if (!step.condition) return true;
  if (step.condition.hasNoCampaigns && ctx.hasCampaigns) return false;
  if (step.condition.hasCampaigns && !ctx.hasCampaigns) return false;
  if (step.condition.hasNoCharacters && ctx.hasCharacters) return false;
  if (step.condition.hasCharacters && !ctx.hasCharacters) return false;
  if (step.condition.hasNoCharactersInSelectedCampaign && ctx.hasCharactersInSelectedCampaign) return false;
  if (step.condition.hasCharactersInSelectedCampaign && !ctx.hasCharactersInSelectedCampaign) return false;
  if (step.condition.hasSelectedCharacter && !ctx.hasSelectedCharacter) return false;
  return true;
}

export interface StepEvaluation {
  step: GuideStep;
  roleRank: number;
  targetExists: boolean;
  targetVisible: boolean;
  conditionMatches: boolean;
  skippedReason?: string;
}

export function evaluateGuideStep(
  step: GuideStep,
  dismissed: Set<string>,
  ctx: GuidanceContext
): StepEvaluation {
  if (dismissed.has(step.id)) {
    return {
      step,
      roleRank: 999,
      targetExists: false,
      targetVisible: false,
      conditionMatches: false,
      skippedReason: "dismissed",
    };
  }

  const roles = effectiveRoles(ctx);
  const stepRole = step.role ?? "any";
  const roleRank = stepRole === "any" ? roles.length : roles.indexOf(stepRole);
  if (stepRole !== "any" && roleRank < 0) {
    return {
      step,
      roleRank: 999,
      targetExists: false,
      targetVisible: false,
      conditionMatches: false,
      skippedReason: "role-mismatch",
    };
  }

  const matches = conditionMatches(step, ctx);
  if (!matches) {
    return {
      step,
      roleRank: roleRank < 0 ? 999 : roleRank,
      targetExists: false,
      targetVisible: false,
      conditionMatches: false,
      skippedReason: "condition-mismatch",
    };
  }

  const target = getGuideTargetElement(step.target);
  if (!target) {
    return {
      step,
      roleRank: roleRank < 0 ? 999 : roleRank,
      targetExists: false,
      targetVisible: false,
      conditionMatches: true,
      skippedReason: "target-missing",
    };
  }

  const visible = isElementActiveAndVisible(target);
  if (!visible) {
    return {
      step,
      roleRank: roleRank < 0 ? 999 : roleRank,
      targetExists: true,
      targetVisible: false,
      conditionMatches: true,
      skippedReason: "target-not-visible",
    };
  }

  return {
    step,
    roleRank: roleRank < 0 ? 999 : roleRank,
    targetExists: true,
    targetVisible: true,
    conditionMatches: true,
  };
}

export function pickNextStep(
  steps: GuideStep[],
  dismissed: Set<string>,
  ctx: GuidanceContext
): GuideStep | null {
  const candidates = steps
    .map((step) => evaluateGuideStep(step, dismissed, ctx))
    .filter((result) => !result.skippedReason);

  if (candidates.length === 0) return null;

  // Sort by role relevance first, then priority.
  candidates.sort((a, b) => {
    if (a.roleRank !== b.roleRank) return a.roleRank - b.roleRank;
    return (b.step.priority ?? 0) - (a.step.priority ?? 0);
  });

  return candidates[0]?.step ?? null;
}
