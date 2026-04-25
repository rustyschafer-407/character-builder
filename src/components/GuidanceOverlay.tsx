import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGuidance } from "./GuidanceProvider";
import { isElementActiveAndVisible } from "../lib/guidance";
import type { GuidancePlacement } from "../lib/guidance";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Finds the guide target element, checks visibility, and optionally scrolls
 * it into view if it is offscreen. Returns the bounding rect, or null if the
 * element is absent, hidden, disabled, or zero-size.
 */
function resolveTargetRect(
  target: string,
  scrollIntoView: boolean
): TargetRect | null {
  const el = document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
  if (!el || !isElementActiveAndVisible(el)) return null;

  const r = el.getBoundingClientRect();
  const inViewport =
    r.top >= 0 &&
    r.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    r.left >= 0 &&
    r.right <= (window.innerWidth || document.documentElement.clientWidth);

  if (!inViewport && scrollIntoView) {
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    // Return the current rect; the overlay will reposition after scroll settles
    // via the scroll event listener in useLayoutEffect.
  }

  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const CARD_WIDTH = 260;
const CARD_GAP = 14;

function computeCardPosition(
  rect: TargetRect,
  placement: GuidancePlacement,
  cardHeight: number
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (placement) {
    case "top":
      top = rect.top - cardHeight - CARD_GAP;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
      break;
    case "bottom":
      top = rect.top + rect.height + CARD_GAP;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - cardHeight / 2;
      left = rect.left - CARD_WIDTH - CARD_GAP;
      break;
    case "right":
    default:
      top = rect.top + rect.height / 2 - cardHeight / 2;
      left = rect.left + rect.width + CARD_GAP;
      break;
  }

  // Clamp within viewport with 8px margin
  left = Math.max(8, Math.min(left, vw - CARD_WIDTH - 8));
  top = Math.max(8, Math.min(top, vh - cardHeight - 8));

  return { top, left };
}

function buildArrowPath(input: {
  placement: GuidancePlacement;
  targetRect: TargetRect;
  cardPos: { top: number; left: number };
  cardHeight: number;
}) {
  const { placement, targetRect, cardPos, cardHeight } = input;
  const cardRight = cardPos.left + CARD_WIDTH;
  const cardBottom = cardPos.top + cardHeight;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  let sx = cardPos.left + CARD_WIDTH / 2;
  let sy = cardPos.top;
  let ex = targetCenterX;
  let ey = targetCenterY;
  let cdx = 0;
  let cdy = 0;

  switch (placement) {
    case "top":
      sx = cardPos.left + CARD_WIDTH / 2;
      sy = cardBottom - 4;
      ex = targetCenterX;
      ey = targetRect.top - 3;
      cdy = 12;
      break;
    case "bottom":
      sx = cardPos.left + CARD_WIDTH / 2;
      sy = cardPos.top + 4;
      ex = targetCenterX;
      ey = targetRect.top + targetRect.height + 3;
      cdy = -12;
      break;
    case "left":
      sx = cardRight - 4;
      sy = cardPos.top + cardHeight / 2;
      ex = targetRect.left - 3;
      ey = targetCenterY;
      cdx = 12;
      break;
    case "right":
    default:
      sx = cardPos.left + 4;
      sy = cardPos.top + cardHeight / 2;
      ex = targetRect.left + targetRect.width + 3;
      ey = targetCenterY;
      cdx = -12;
      break;
  }

  const cx = (sx + ex) / 2 + cdx;
  const cy = (sy + ey) / 2 + cdy;
  const d = `M ${sx.toFixed(2)} ${sy.toFixed(2)} Q ${cx.toFixed(2)} ${cy.toFixed(2)} ${ex.toFixed(2)} ${ey.toFixed(2)}`;

  // Build a tiny hand-drawn arrow head aligned to the end tangent.
  const angle = Math.atan2(ey - cy, ex - cx);
  const headLength = 10;
  const spread = 0.5;
  const hx1 = ex - headLength * Math.cos(angle - spread);
  const hy1 = ey - headLength * Math.sin(angle - spread);
  const hx2 = ex - headLength * Math.cos(angle + spread);
  const hy2 = ey - headLength * Math.sin(angle + spread);
  const head = `M ${hx1.toFixed(2)} ${hy1.toFixed(2)} L ${ex.toFixed(2)} ${ey.toFixed(2)} L ${hx2.toFixed(2)} ${hy2.toFixed(2)}`;

  return { d, head };
}

export default function GuidanceOverlay() {
  const { activeStep, hasNextStep, dismissCurrent, dismissPermanently, advance } =
    useGuidance();

  const cardRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  // Main layout effect: find target, scroll if needed, position the card.
  // Runs on every activeStep change and on scroll/resize.
  useLayoutEffect(() => {
    if (!activeStep) {
      setCardPos(null);
      setTargetRect(null);
      return;
    }

    let scrollSettleTimer: ReturnType<typeof setTimeout> | null = null;

    function recalc(scrollIntoView = false) {
      if (!activeStep) return;
      const rect = resolveTargetRect(activeStep.target, scrollIntoView);
      setTargetRect(rect);
      if (!rect) {
        setCardPos(null);
        return;
      }
      const cardH = cardRef.current?.offsetHeight ?? 140;
      setCardPos(computeCardPosition(rect, activeStep.placement ?? "bottom", cardH));
    }

    // Initial: scroll if offscreen, then settle-reposition
    recalc(true);
    scrollSettleTimer = setTimeout(() => recalc(false), 550);

    function onScroll() { recalc(false); }
    function onResize() { recalc(false); }

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });

    return () => {
      if (scrollSettleTimer !== null) clearTimeout(scrollSettleTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [activeStep]);

  // ResizeObserver on target: repositions if the target element itself resizes
  // (e.g. button label changes, panel expands) without a window resize event.
  useEffect(() => {
    if (!activeStep) return;
    const el = document.querySelector<HTMLElement>(`[data-guide="${activeStep.target}"]`);
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      const rect = resolveTargetRect(activeStep.target, false);
      setTargetRect(rect);
      if (!rect) { setCardPos(null); return; }
      const cardH = cardRef.current?.offsetHeight ?? 140;
      setCardPos(computeCardPosition(rect, activeStep.placement ?? "bottom", cardH));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeStep]);

  // Recalculate once card height is first known (second paint)
  useEffect(() => {
    if (!activeStep || !cardRef.current) return;
    const rect = resolveTargetRect(activeStep.target, false);
    if (!rect) return;
    const cardH = cardRef.current.offsetHeight;
    setCardPos(computeCardPosition(rect, activeStep.placement ?? "bottom", cardH));
  }, [activeStep]);

  // Move focus to the primary action button when the card first appears.
  // Non-trapping: user can Tab or Escape freely.
  useEffect(() => {
    if (activeStep && cardPos && firstButtonRef.current) {
      firstButtonRef.current.focus({ preventScroll: true });
    }
  }, [activeStep, cardPos]);

  // Escape key dismisses the current hint (session only, same as "Got it")
  useEffect(() => {
    if (!activeStep) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        dismissCurrent();
      }
    }
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [activeStep, dismissCurrent]);

  if (!activeStep || !targetRect) return null;

  const placement = activeStep.placement ?? "bottom";
  const bodyId = `chalk-card-body-${activeStep.id}`;
  const cardHeight = cardRef.current?.offsetHeight ?? 140;
  const arrow = cardPos
    ? buildArrowPath({
        placement,
        targetRect,
        cardPos,
        cardHeight,
      })
    : null;

  return (
    <>
      {/* Chalk ring around target element */}
      <div
        aria-hidden
        className="chalk-target-ring"
        style={{
          position: "fixed",
          top: targetRect.top - 6,
          left: targetRect.left - 6,
          width: targetRect.width + 12,
          height: targetRect.height + 12,
          pointerEvents: "none",
          zIndex: 9990,
        }}
      />

      {/* Directional arrow between card and target */}
      {cardPos && arrow ? (
        <svg
          aria-hidden
          className="chalk-arrow"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 9991,
          }}
          width="100%"
          height="100%"
          viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
          preserveAspectRatio="none"
        >
          <path d={arrow.d} className="chalk-arrow-soft" />
          <path d={arrow.d} className="chalk-arrow-main" />
          <path d={arrow.head} className="chalk-arrow-main" />
        </svg>
      ) : null}

      {/* Note card — non-modal dialog; does not trap focus */}
      {cardPos && (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="false"
          aria-label={activeStep.title}
          aria-describedby={bodyId}
          className="chalk-card"
          style={{
            position: "fixed",
            top: cardPos.top,
            left: cardPos.left,
            width: CARD_WIDTH,
            zIndex: 9992,
          }}
        >
          <p className="chalk-card-title">{activeStep.title}</p>
          <p id={bodyId} className="chalk-card-body">{activeStep.body}</p>
          <div className="chalk-card-actions">
            <button
              ref={firstButtonRef}
              className="chalk-btn chalk-btn-primary"
              aria-label={hasNextStep ? "Next hint" : "Got it, dismiss hint"}
              onClick={hasNextStep ? advance : dismissCurrent}
            >
              {hasNextStep ? "Next" : "Got it"}
            </button>
            <button
              className="chalk-btn chalk-btn-muted"
              aria-label={`Don't show "${activeStep.title}" again`}
              onClick={dismissPermanently}
            >
              Don't show again
            </button>
          </div>
        </div>
      )}
    </>
  );
}
