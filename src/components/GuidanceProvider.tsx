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
  pickNextStep,
  readDismissedSteps,
  resetAllDismissedSteps,
  writeDismissedSteps,
  type GuideStep,
  type GuidanceContext,
} from "../lib/guidance";
import { ALL_GUIDE_STEPS } from "../lib/guidanceSteps";

interface GuidanceState {
  activeStep: GuideStep | null;
  hasNextStep: boolean;
  dismissCurrent: () => void;
  dismissPermanently: () => void;
  advance: () => void;
  resetGuidance: () => void;
  /** Call this after major layout changes (flyout open/close, campaign switch, panel transitions) */
  notifyLayoutChanged: () => void;
}

const GuidanceCtx = createContext<GuidanceState>({
  activeStep: null,
  hasNextStep: false,
  dismissCurrent: () => undefined,
  dismissPermanently: () => undefined,
  advance: () => undefined,
  resetGuidance: () => undefined,
  notifyLayoutChanged: () => undefined,
});

export function useGuidance(): GuidanceState {
  return useContext(GuidanceCtx);
}

interface GuidanceProviderProps {
  isAdmin: boolean;
  isGm: boolean;
  campaignRoles: Record<string, "player" | "editor">;
  hasCharacters: boolean;
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
  hasCharacters,
  isReady = true,
  userId,
  children,
}: GuidanceProviderProps) {
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

  const ctx: GuidanceContext = useMemo(
    () => ({ isAdmin, isGm, campaignRoles, hasCharacters }),
    [isAdmin, isGm, campaignRoles, hasCharacters]
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

  // Re-evaluate active step whenever context, dismissed set, tick, or readiness changes.
  // Delayed slightly so newly rendered target elements are present in the DOM.
  useEffect(() => {
    if (!isReady) {
      setActiveStep(null);
      return;
    }
    const timer = setTimeout(() => {
      const next = pickNextStep(ALL_GUIDE_STEPS, effectiveDismissed, ctx);
      setActiveStep(next);
    }, 400);
    return () => clearTimeout(timer);
  }, [ctx, effectiveDismissed, tick, isReady]);

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
    dismissCurrent();
  }, [dismissCurrent]);

  const resetGuidance = useCallback(() => {
    resetAllDismissedSteps(userId);
    setDismissed(new Set());
    setSessionDismissed(new Set());
    setTick((t) => t + 1);
  }, [userId]);

  const notifyLayoutChanged = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  // Compute whether there is a next step after dismissing the current one
  const hasNextStep = useMemo(() => {
    if (!activeStep) return false;
    const withCurrent = new Set(effectiveDismissed);
    withCurrent.add(activeStep.id);
    return pickNextStep(ALL_GUIDE_STEPS, withCurrent, ctx) !== null;
  }, [activeStep, effectiveDismissed, ctx]);

  const value: GuidanceState = {
    activeStep,
    hasNextStep,
    dismissCurrent,
    dismissPermanently,
    advance,
    resetGuidance,
    notifyLayoutChanged,
  };

  return <GuidanceCtx.Provider value={value}>{children}</GuidanceCtx.Provider>;
}
