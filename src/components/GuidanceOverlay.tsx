/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGuidance } from "./GuidanceProvider";
import { getGuideTargetElement, isElementActiveAndVisible, type GuidancePlacement } from "../lib/guidance";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_MIN_WIDTH = 280;
const CARD_MAX_WIDTH = 360;
const VIEWPORT_MARGIN = 16;
const CARD_GAP = 14;

function resolveTargetRect(target: string): TargetRect | null {
  const element = getGuideTargetElement(target);
  if (!element || !isElementActiveAndVisible(element)) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

function intersects(a: { top: number; left: number; width: number; height: number }, b: TargetRect): boolean {
  return !(
    a.left + a.width < b.left ||
    a.left > b.left + b.width ||
    a.top + a.height < b.top ||
    a.top > b.top + b.height
  );
}

function placeCard(
  rect: TargetRect,
  placement: GuidancePlacement,
  cardWidth: number,
  cardHeight: number
): { top: number; left: number; width: number; height: number } {
  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = rect.top + rect.height + CARD_GAP;
      left = rect.left + rect.width / 2 - cardWidth / 2;
      break;
    case "right":
      top = rect.top + rect.height / 2 - cardHeight / 2;
      left = rect.left + rect.width + CARD_GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2 - cardHeight / 2;
      left = rect.left - cardWidth - CARD_GAP;
      break;
    case "top":
    default:
      top = rect.top - cardHeight - CARD_GAP;
      left = rect.left + rect.width / 2 - cardWidth / 2;
      break;
  }

  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - cardWidth - VIEWPORT_MARGIN));
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, window.innerHeight - cardHeight - VIEWPORT_MARGIN));

  return { top, left, width: cardWidth, height: cardHeight };
}

function pickCardPosition(input: {
  targetRect: TargetRect;
  preferredPlacement: GuidancePlacement;
  cardWidth: number;
  cardHeight: number;
}) {
  const order: GuidancePlacement[] = [
    input.preferredPlacement,
    "bottom",
    "right",
    "left",
    "top",
  ].filter((value, index, list) => list.indexOf(value) === index) as GuidancePlacement[];

  for (const placement of order) {
    const candidate = placeCard(input.targetRect, placement, input.cardWidth, input.cardHeight);
    if (!intersects(candidate, input.targetRect)) {
      return candidate;
    }
  }

  return placeCard(input.targetRect, "bottom", input.cardWidth, input.cardHeight);
}

export default function GuidanceOverlay() {
  const {
    guideSession,
    activeStep,
    totalSteps,
    nextStep,
    previousStep,
    endTour,
    completeTour,
    tourRepositionToken,
  } = useGuidance();

  const cardRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number } | null>(null);

  const isTourActive = guideSession.mode === "tour" && Boolean(activeStep);

  useLayoutEffect(() => {
    if (!isTourActive || !activeStep) return;

    const step = activeStep;

    function recalc() {
      const rect = resolveTargetRect(step.target);
      setTargetRect(rect);
      if (!rect) {
        setCardPosition(null);
        return;
      }

      const measuredWidth = cardRef.current?.offsetWidth ?? 320;
      const measuredHeight = cardRef.current?.offsetHeight ?? 170;
      const cardWidth = Math.max(CARD_MIN_WIDTH, Math.min(CARD_MAX_WIDTH, measuredWidth));

      const nextPosition = pickCardPosition({
        targetRect: rect,
        preferredPlacement: step.placement ?? "bottom",
        cardWidth,
        cardHeight: measuredHeight,
      });

      setCardPosition({ top: nextPosition.top, left: nextPosition.left });
    }

    recalc();

    function onScrollOrResize() {
      recalc();
    }

    window.addEventListener("resize", onScrollOrResize, { passive: true });
    window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });

    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, { capture: true });
    };
  }, [activeStep, isTourActive, tourRepositionToken]);

  useEffect(() => {
    if (isTourActive) return;
    setTargetRect(null);
    setCardPosition(null);
  }, [isTourActive]);

  useEffect(() => {
    if (!isTourActive || !cardPosition || !firstActionRef.current) return;
    firstActionRef.current.focus({ preventScroll: true });
  }, [cardPosition, isTourActive]);

  useEffect(() => {
    if (!isTourActive) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        endTour();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextStep();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousStep();
      }
    }

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [endTour, isTourActive, nextStep, previousStep]);

  if (!isTourActive || !activeStep || !targetRect || !cardPosition) return null;

  const currentStepNumber = guideSession.stepIndex + 1;
  const isLastStep = currentStepNumber >= totalSteps;

  return (
    <>
      <div className="guide-backdrop" aria-hidden />
      <div
        aria-hidden
        className="guide-target-outline"
        style={{
          top: `${targetRect.top - 4}px`,
          left: `${targetRect.left - 4}px`,
          width: `${targetRect.width + 8}px`,
          height: `${targetRect.height + 8}px`,
        }}
      />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        className="guide-popover"
        style={{
          top: `${cardPosition.top}px`,
          left: `${cardPosition.left}px`,
        }}
      >
        <div className="guide-popover-head">
          <p className="guide-popover-title">{activeStep.title}</p>
          <p className="guide-popover-progress">Step {currentStepNumber} of {Math.max(totalSteps, 1)}</p>
        </div>
        <p className="guide-popover-body">{activeStep.body}</p>

        <div className="guide-popover-footer">
          <button className="guide-btn guide-btn-muted" onClick={endTour}>
            End tour
          </button>
          <div className="guide-popover-footer-right">
            <button
              className="guide-btn guide-btn-muted"
              onClick={previousStep}
              disabled={currentStepNumber === 1}
            >
              Back
            </button>
            <button
              ref={firstActionRef}
              className="guide-btn guide-btn-primary"
              onClick={isLastStep ? completeTour : nextStep}
            >
              {isLastStep ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
