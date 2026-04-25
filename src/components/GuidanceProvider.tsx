import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  evaluateGuideStep,
  pickNextStep,
  readDismissedSteps,
  resetAllDismissedSteps,
  writeDismissedSteps,
  type GuideStep,
  type GuidanceContext,
  type GuidanceMode,
} from "../lib/guidance";
import { ALL_GUIDE_STEPS } from "../lib/guidanceSteps";

interface GuidanceState {
  activeStep: GuideStep | null;
  hasNextStep: boolean;
  mode: GuidanceMode;
  dismissCurrent: () => void;
  dismissPermanently: () => void;
  advance: () => void;
  resetGuidance: () => void;
  startWalkthrough: () => void;
  finishWalkthrough: () => void;
  /** Call this after major layout changes (flyout open/close, campaign switch, panel transitions) */
  notifyLayoutChanged: () => void;
}

const GuidanceCtx = createContext<GuidanceState>({
  activeStep: null,
  hasNextStep: false,
  mode: "contextual",
  dismissCurrent: () => undefined,
  dismissPermanently: () => undefined,
  advance: () => undefined,
  resetGuidance: () => undefined,
  startWalkthrough: () => undefined,
  finishWalkthrough: () => undefined,
  notifyLayoutChanged: () => undefined,
});

export function useGuidance(): GuidanceState {
  return useContext(GuidanceCtx);
}

interface GuidanceProviderProps {
  isAdmin: boolean;
  isGm: boolean;
  campaignRoles: Record<string, "player" | "editor">;
  selectedCampaignRole?: "player" | "editor" | null;
  hasCampaigns: boolean;
  hasCharacters: boolean;
  hasCharactersInSelectedCampaign: boolean;
  hasSelectedCharacter: boolean;
  suppressGuidance?: boolean;
  /** Optional key that changes when route/panel context shifts. */
  contextKey?: string;
  /** Minimum delay before re-showing a contextual hint that was already shown. */
  cooldownMs?: number;
  /**
   * Pass true once auth + initial data are resolved.
   * Guidance is suppressed while loading to prevent flicker on stale role data.
   */
  isReady?: boolean;
  /**
   * Authenticated user ID. When provided, dismissed steps are stored under a
   * user-scoped localStorage key so different users on the same device see
   * their own dismissed state.
   */
  userId?: string | null;
  children: ReactNode;
}

export function GuidanceProvider({
  isAdmin,
  isGm,
  campaignRoles,
  selectedCampaignRole = null,
  hasCampaigns,
  hasCharacters,
  hasCharactersInSelectedCampaign,
  hasSelectedCharacter,
  suppressGuidance = false,
  contextKey,
  cooldownMs = 5 * 60 * 1000,
  isReady = true,
  userId,
  children,
}: GuidanceProviderProps) {
  const [mode, setMode] = useState<GuidanceMode>("contextual");

  // Permanent dismissals — persisted to localStorage under a user-scoped key
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    readDismissedSteps(userId)
  );

  // Re-read persisted dismissals when userId changes (user signs in/out)
  useEffect(() => {
    setDismissed(readDismissedSteps(userId));
  }, [userId]);

  // Session-only dismissals ("Got it") — cleared on reload, stored in state
  // so effectiveDismissed memo recomputes correctly (avoids stale ref bug).
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(
    new Set()
  );

  // Tracks hints shown in this tab/session so contextual mode avoids repeats.
  const [seenThisSession, setSeenThisSession] = useState<Set<string>>(new Set());

  const shownKey = useMemo(
    () => (userId ? `cb.guidance.lastShown.${userId}` : "cb.guidance.lastShown"),
    [userId]
  );

  const [lastShownByStep, setLastShownByStep] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(userId ? `cb.guidance.lastShown.${userId}` : "cb.guidance.lastShown");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Record<string, number>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(shownKey);
      if (!raw) {
        setLastShownByStep({});
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setLastShownByStep({});
        return;
      }
      setLastShownByStep(parsed as Record<string, number>);
    } catch {
      setLastShownByStep({});
    }
  }, [shownKey]);

  const ctx: GuidanceContext = useMemo(
    () => ({
      isAdmin,
      isGm,
      campaignRoles,
      selectedCampaignRole,
      hasCampaigns,
      hasCharacters,
      hasCharactersInSelectedCampaign,
      hasSelectedCharacter,
    }),
    [
      isAdmin,
      isGm,
      campaignRoles,
      selectedCampaignRole,
      hasCampaigns,
      hasCharacters,
      hasCharactersInSelectedCampaign,
      hasSelectedCharacter,
    ]
  );

  // Combined set used for step selection
  const effectiveDismissed = useMemo(() => {
    const combined = new Set(dismissed);
    for (const id of sessionDismissed) combined.add(id);
    return combined;
  }, [dismissed, sessionDismissed]);

  const [activeStep, setActiveStep] = useState<GuideStep | null>(null);
  // Bumped to force re-evaluation after layout changes (flyouts, panels, resize)
  const [tick, setTick] = useState(0);

  const debugEnabled = useMemo(() => {
    try {
      return localStorage.getItem("cb.guidance.debug") === "1";
    } catch {
      return false;
    }
  }, []);

  const logDebug = useCallback(
    (message: string, detail?: unknown) => {
      if (!debugEnabled) return;
      // eslint-disable-next-line no-console
      console.info(`[guidance] ${message}`, detail ?? "");
    },
    [debugEnabled]
  );

  // Re-evaluate active step whenever context, dismissed set, tick, or readiness changes.
  // Delayed slightly so newly rendered target elements are present in the DOM.
  useEffect(() => {
    if (!isReady || suppressGuidance) {
      setActiveStep(null);
      return;
    }

    const now = Date.now();
    const baseDismissed = new Set(effectiveDismissed);
    let dismissedForMode = baseDismissed;

    if (mode === "contextual") {
      dismissedForMode = new Set(baseDismissed);
      for (const id of seenThisSession) dismissedForMode.add(id);
      for (const [id, shownAt] of Object.entries(lastShownByStep)) {
        if (Number.isFinite(shownAt) && now - shownAt < cooldownMs) {
          dismissedForMode.add(id);
        }
      }
    }

    const timer = setTimeout(() => {
      const next = pickNextStep(ALL_GUIDE_STEPS, dismissedForMode, ctx);
      if (!next) {
        logDebug("no active step", { mode, contextKey });
      } else {
        logDebug("picked active step", { stepId: next.id, mode, contextKey });
      }
      setActiveStep(next);
    }, 260);
    return () => clearTimeout(timer);
  }, [
    ctx,
    effectiveDismissed,
    tick,
    isReady,
    suppressGuidance,
    mode,
    seenThisSession,
    lastShownByStep,
    cooldownMs,
    contextKey,
    logDebug,
  ]);

  // Mark current step as shown to prevent noisy repeats in contextual mode.
  useEffect(() => {
    if (!activeStep) return;
    const now = Date.now();
    setSeenThisSession((prev) => {
      if (prev.has(activeStep.id)) return prev;
      return new Set([...prev, activeStep.id]);
    });
    setLastShownByStep((prev) => {
      const next = { ...prev, [activeStep.id]: now };
      try {
        localStorage.setItem(shownKey, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [activeStep, shownKey]);

  // Re-evaluate on window resize so targets that appear/disappear are caught
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("resize", bump, { passive: true });
    return () => window.removeEventListener("resize", bump);
  }, []);

  const dismissCurrent = useCallback(() => {
    if (!activeStep) return;
    // Add to session dismissed — effectiveDismissed will recompute and trigger re-evaluation
    setSessionDismissed((prev) => new Set([...prev, activeStep.id]));
    setActiveStep(null);
  }, [activeStep]);

  const dismissPermanently = useCallback(() => {
    if (!activeStep) return;
    const next = new Set(dismissed);
    next.add(activeStep.id);
    writeDismissedSteps(next, userId);
    setDismissed(next);
    setActiveStep(null);
  }, [activeStep, dismissed, userId]);

  const advance = useCallback(() => {
    if (!activeStep) return;
    setSessionDismissed((prev) => new Set([...prev, activeStep.id]));
    setActiveStep(null);
  }, [activeStep]);

  const resetGuidance = useCallback(() => {
    resetAllDismissedSteps(userId);
    try {
      localStorage.removeItem(shownKey);
    } catch {
      // ignore
    }
    setDismissed(new Set());
    setSessionDismissed(new Set());
    setSeenThisSession(new Set());
    setLastShownByStep({});
    setMode("contextual");
    setTick((t) => t + 1);
  }, [shownKey, userId]);

  const startWalkthrough = useCallback(() => {
    setMode("walkthrough");
    setSessionDismissed(new Set());
    setTick((t) => t + 1);
  }, []);

  const finishWalkthrough = useCallback(() => {
    setMode("contextual");
    setSessionDismissed(new Set());
    setActiveStep(null);
    setTick((t) => t + 1);
  }, []);

  const notifyLayoutChanged = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  // Compute whether there is a next step after dismissing the current one
  const hasNextStep = useMemo(() => {
    if (!activeStep) return false;
    const withCurrent = new Set(effectiveDismissed);
    withCurrent.add(activeStep.id);
    if (mode === "walkthrough") {
      return pickNextStep(ALL_GUIDE_STEPS, withCurrent, ctx) !== null;
    }

    const now = Date.now();
    for (const id of seenThisSession) withCurrent.add(id);
    for (const [id, shownAt] of Object.entries(lastShownByStep)) {
      if (Number.isFinite(shownAt) && now - shownAt < cooldownMs) {
        withCurrent.add(id);
      }
    }
    return pickNextStep(ALL_GUIDE_STEPS, withCurrent, ctx) !== null;
  }, [activeStep, effectiveDismissed, ctx, mode, seenThisSession, lastShownByStep, cooldownMs]);

  // Lightweight diagnostics for debugging role/condition/target mismatches.
  useEffect(() => {
    if (!debugEnabled || !isReady || suppressGuidance || activeStep) return;
    const reasons = ALL_GUIDE_STEPS.map((step) => evaluateGuideStep(step, effectiveDismissed, ctx)).map((x) => ({
      id: x.step.id,
      reason: x.skippedReason ?? "eligible",
    }));
    logDebug("step evaluations", reasons);
  }, [activeStep, ctx, debugEnabled, effectiveDismissed, isReady, logDebug, suppressGuidance]);

  const value: GuidanceState = {
    activeStep,
    hasNextStep,
    mode,
    dismissCurrent,
    dismissPermanently,
    advance,
    resetGuidance,
    startWalkthrough,
    finishWalkthrough,
    notifyLayoutChanged,
  };

  return <GuidanceCtx.Provider value={value}>{children}</GuidanceCtx.Provider>;
}
