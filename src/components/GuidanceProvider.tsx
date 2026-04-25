/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getPrimaryRole,
  hasPermission,
  isStepValidForContext,
  readCompletedTourIds,
  readDismissedEmptyStateIds,
  readHelpDisabled,
  resetHelpCoachState,
  type EmptyStateGuideCard,
  type GuidePermission,
  type GuideSession,
  type GuideStep,
  type GuidanceContext,
  type GuidancePage,
  type GuidanceRole,
  writeCompletedTourIds,
  writeDismissedEmptyStateIds,
  writeHelpDisabled,
} from "../lib/guidance";
import { EMPTY_STATE_GUIDE_CARDS, GUIDE_TOUR_STEPS } from "../lib/guidanceSteps";

interface GuidanceState {
  guideSession: GuideSession;
  activeStep: GuideStep | null;
  totalSteps: number;
  emptyStateCard: EmptyStateGuideCard | null;
  helpDisabled: boolean;
  isInlineHelpVisible: boolean;
  tourRepositionToken: number;
  startPageTour: () => void;
  showInlineHelpForPage: () => void;
  hideInlineHelpForPage: () => void;
  nextStep: () => void;
  previousStep: () => void;
  endTour: () => void;
  completeTour: () => void;
  dismissEmptyStateCard: (id: string) => void;
  resetHelpCoach: () => void;
  setHelpDisabled: (disabled: boolean) => void;
  notifyLayoutChanged: () => void;
}

const GuidanceCtx = createContext<GuidanceState>({
  guideSession: { mode: "closed", stepIndex: 0, startedByUser: false },
  activeStep: null,
  totalSteps: 0,
  emptyStateCard: null,
  helpDisabled: false,
  isInlineHelpVisible: false,
  tourRepositionToken: 0,
  startPageTour: () => undefined,
  showInlineHelpForPage: () => undefined,
  hideInlineHelpForPage: () => undefined,
  nextStep: () => undefined,
  previousStep: () => undefined,
  endTour: () => undefined,
  completeTour: () => undefined,
  dismissEmptyStateCard: () => undefined,
  resetHelpCoach: () => undefined,
  setHelpDisabled: () => undefined,
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
  page: GuidancePage;
  hasCampaigns: boolean;
  hasCharacters: boolean;
  hasCharactersInSelectedCampaign: boolean;
  userId?: string | null;
  permissions: Partial<Record<GuidePermission, boolean>>;
  children: ReactNode;
}

function getDefaultTourId(page: GuidancePage, role: GuidanceRole): string | null {
  if (page !== "main") return null;
  if (role === "admin") return "main-admin";
  if (role === "gm") return "main-gm";
  return "main-player";
}

export function GuidanceProvider({
  isAdmin,
  isGm,
  campaignRoles,
  selectedCampaignRole = null,
  page,
  hasCampaigns,
  hasCharacters,
  hasCharactersInSelectedCampaign,
  userId,
  permissions,
  children,
}: GuidanceProviderProps) {
  const userRole = useMemo(
    () =>
      getPrimaryRole({
        isAdmin,
        isGm,
        selectedCampaignRole,
        campaignRoles,
      }),
    [campaignRoles, isAdmin, isGm, selectedCampaignRole]
  );

  const guidanceContext: GuidanceContext = useMemo(
    () => ({
      userRole,
      page,
      permissions,
    }),
    [userRole, page, permissions]
  );

  const [guideSession, setGuideSession] = useState<GuideSession>({
    mode: "closed",
    stepIndex: 0,
    startedByUser: false,
  });
  const [dismissedEmptyStateIds, setDismissedEmptyStateIds] = useState<Set<string>>(() =>
    readDismissedEmptyStateIds(userId)
  );
  const [completedTourIds, setCompletedTourIds] = useState<Set<string>>(() => readCompletedTourIds(userId));
  const [helpDisabled, setHelpDisabledState] = useState<boolean>(() => readHelpDisabled(userId));
  const [tourRepositionToken, setTourRepositionToken] = useState(0);

  const emptyStateCard = useMemo(() => {
    if (helpDisabled) return null;
    if (page !== "main") return null;

    const candidates = EMPTY_STATE_GUIDE_CARDS.filter((card) => {
      if (card.page !== page) return false;
      if (!card.allowedRoles.includes(userRole)) return false;
      if (!hasPermission(permissions, card.requiredPermission)) return false;
      if (dismissedEmptyStateIds.has(card.id)) return false;

      if (card.id === "main-no-campaigns") {
        return !hasCampaigns;
      }

      if (card.id === "main-no-characters") {
        return hasCampaigns && !hasCharacters && !hasCharactersInSelectedCampaign;
      }

      return false;
    });

    return candidates[0] ?? null;
  }, [dismissedEmptyStateIds, hasCampaigns, hasCharacters, hasCharactersInSelectedCampaign, helpDisabled, page, permissions, userRole]);

  const resolvedMode: GuideSession["mode"] = useMemo(() => {
    if (helpDisabled) return "closed";
    if (guideSession.mode === "tour" || guideSession.mode === "inline") {
      return guideSession.mode;
    }
    return emptyStateCard ? "emptyState" : "closed";
  }, [emptyStateCard, guideSession.mode, helpDisabled]);

  const activeTourSteps = useMemo(() => {
    if (resolvedMode !== "tour" || !guideSession.tourId || helpDisabled) return [];

    return GUIDE_TOUR_STEPS.filter(
      (step) => step.tourId === guideSession.tourId && isStepValidForContext(step, guidanceContext)
    );
  }, [guideSession.tourId, guidanceContext, helpDisabled, resolvedMode]);

  const resolvedStepIndex = useMemo(() => {
    if (resolvedMode !== "tour") return 0;
    if (activeTourSteps.length === 0) return 0;
    return Math.min(guideSession.stepIndex, activeTourSteps.length - 1);
  }, [activeTourSteps.length, guideSession.stepIndex, resolvedMode]);

  const activeStep = useMemo(() => {
    if (resolvedMode !== "tour") return null;
    return activeTourSteps[resolvedStepIndex] ?? null;
  }, [activeTourSteps, resolvedMode, resolvedStepIndex]);

  const startPageTour = useCallback(() => {
    if (helpDisabled) return;
    const tourId = getDefaultTourId(page, userRole);
    if (!tourId) return;
    setGuideSession({
      mode: "tour",
      tourId,
      stepIndex: 0,
      startedByUser: true,
    });
  }, [helpDisabled, page, userRole]);

  const showInlineHelpForPage = useCallback(() => {
    if (helpDisabled) return;
    setGuideSession((prev) => ({ ...prev, mode: "inline" }));
  }, [helpDisabled]);

  const hideInlineHelpForPage = useCallback(() => {
    setGuideSession((prev) => ({ ...prev, mode: emptyStateCard ? "emptyState" : "closed" }));
  }, [emptyStateCard]);

  const endTour = useCallback(() => {
    setGuideSession((prev) => ({
      ...prev,
      mode: emptyStateCard ? "emptyState" : "closed",
      stepIndex: 0,
      startedByUser: false,
      tourId: undefined,
    }));
  }, [emptyStateCard]);

  const completeTour = useCallback(() => {
    const tourId = guideSession.tourId;
    if (tourId) {
      const next = new Set(completedTourIds);
      next.add(tourId);
      writeCompletedTourIds(next, userId);
      setCompletedTourIds(next);
    }
    setGuideSession((prev) => ({
      ...prev,
      mode: emptyStateCard ? "emptyState" : "closed",
      stepIndex: 0,
      startedByUser: false,
      tourId: undefined,
    }));
  }, [completedTourIds, emptyStateCard, guideSession.tourId, userId]);

  const nextStep = useCallback(() => {
    if (resolvedMode !== "tour") return;
    const nextIndex = resolvedStepIndex + 1;
    if (nextIndex >= activeTourSteps.length) {
      completeTour();
      return;
    }
    setGuideSession((prev) => ({ ...prev, stepIndex: prev.stepIndex + 1 }));
  }, [activeTourSteps.length, completeTour, resolvedMode, resolvedStepIndex]);

  const previousStep = useCallback(() => {
    if (resolvedMode !== "tour") return;
    if (resolvedStepIndex <= 0) return;
    setGuideSession((prev) => ({ ...prev, stepIndex: Math.max(0, prev.stepIndex - 1) }));
  }, [resolvedMode, resolvedStepIndex]);

  const dismissEmptyStateCard = useCallback(
    (id: string) => {
      const next = new Set(dismissedEmptyStateIds);
      next.add(id);
      writeDismissedEmptyStateIds(next, userId);
      setDismissedEmptyStateIds(next);
      setGuideSession((prev) => ({ ...prev, mode: "closed" }));
    },
    [dismissedEmptyStateIds, userId]
  );

  const resetHelpCoach = useCallback(() => {
    resetHelpCoachState(userId);
    setDismissedEmptyStateIds(new Set());
    setCompletedTourIds(new Set());
    setHelpDisabledState(false);
    setGuideSession({ mode: "closed", stepIndex: 0, startedByUser: false });
  }, [userId]);

  const setHelpDisabled = useCallback(
    (disabled: boolean) => {
      writeHelpDisabled(disabled, userId);
      setHelpDisabledState(disabled);
      if (disabled) {
        setGuideSession({ mode: "closed", stepIndex: 0, startedByUser: false });
      }
    },
    [userId]
  );

  const notifyLayoutChanged = useCallback(() => {
    if (resolvedMode !== "tour" || !activeStep) return;
    setTourRepositionToken((token) => token + 1);
  }, [activeStep, resolvedMode]);

  const value: GuidanceState = {
    guideSession: {
      ...guideSession,
      mode: resolvedMode,
      stepIndex: resolvedStepIndex,
    },
    activeStep,
    totalSteps: activeTourSteps.length,
    emptyStateCard,
    helpDisabled,
    isInlineHelpVisible: resolvedMode === "inline",
    tourRepositionToken,
    startPageTour,
    showInlineHelpForPage,
    hideInlineHelpForPage,
    nextStep,
    previousStep,
    endTour,
    completeTour,
    dismissEmptyStateCard,
    resetHelpCoach,
    setHelpDisabled,
    notifyLayoutChanged,
  };

  return <GuidanceCtx.Provider value={value}>{children}</GuidanceCtx.Provider>;
}
