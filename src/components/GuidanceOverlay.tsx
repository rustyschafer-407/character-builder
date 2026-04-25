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

type ChalkRectOptions = {
  width: number;
  height: number;
  pad?: number;
  wobble?: number;
};

function makeChalkRectPath({
  width,
  height,
  pad = 8,
  wobble = 4,
}: ChalkRectOptions): string {
  const w = Math.max(24, width + pad * 2);
  const h = Math.max(24, height + pad * 2);

  // Deterministic offsets. Do not use Math.random; the path should not jump on rerender.
  const o = {
    tlx: 2,
    tly: -1,
    trx: -3,
    try: 2,
    brx: 3,
    bry: 1,
    blx: -2,
    bly: -2,
    topMid: -wobble * 0.35,
    rightMid: wobble * 0.45,
    bottomMid: wobble * 0.25,
    leftMid: -wobble * 0.4,
  };

  const r = Math.min(22, Math.max(10, Math.min(w, h) * 0.18));

  return [
    `M ${r + o.tlx} ${2 + o.tly}`,
    `Q ${w / 2} ${2 + o.topMid}, ${w - r + o.trx} ${3 + o.try}`,
    `Q ${w - 2 + o.trx} ${3 + o.try}, ${w - 3 + o.trx} ${r}`,
    `Q ${w + o.rightMid} ${h / 2}, ${w - 4 + o.brx} ${h - r + o.bry}`,
    `Q ${w - 5 + o.brx} ${h - 4 + o.bry}, ${w - r + o.brx} ${h - 3 + o.bry}`,
    `Q ${w / 2} ${h + o.bottomMid}, ${r + o.blx} ${h - 4 + o.bly}`,
    `Q ${3 + o.blx} ${h - 4 + o.bly}, ${3 + o.blx} ${h - r + o.bly}`,
    `Q ${o.leftMid} ${h / 2}, ${4 + o.tlx} ${r + o.tly}`,
    `Q ${4 + o.tlx} ${4 + o.tly}, ${r + o.tlx} ${2 + o.tly}`,
    `Z`,
  ].join(" ");
}

function makeChalkArrowPath(startX: number, startY: number, endX: number, endY: number): string {
  const dx = endX - startX;
  const dy = endY - startY;

  // Deterministic curve offsets so the arrow looks hand-drawn but does not jump.
  const bend = Math.max(-35, Math.min(35, dx * 0.18));
  const lift = Math.max(-24, Math.min(24, dy * 0.22));

  const c1x = startX + dx * 0.35 + bend;
  const c1y = startY + dy * 0.15 - 10;
  const c2x = startX + dx * 0.72 - bend * 0.4;
  const c2y = startY + dy * 0.82 + lift;

  return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
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

  const d = makeChalkArrowPath(sx, sy, ex + cdx * 0.08, ey + cdy * 0.08);

  // Build a tiny hand-drawn arrow head aligned to the end tangent.
  const angle = Math.atan2(ey - sy, ex - sx);
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
  const {
    activeStep,
    hasNextStep,
    mode,
    dismissCurrent,
    dismissPermanently,
    advance,
    finishWalkthrough,
  } =
    useGuidance();

  const cardRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const recalcRafRef = useRef<number | null>(null);
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

    function scheduleRecalc(scrollIntoView = false) {
      if (recalcRafRef.current !== null) {
        window.cancelAnimationFrame(recalcRafRef.current);
      }
      recalcRafRef.current = window.requestAnimationFrame(() => {
        recalc(scrollIntoView);
      });
    }

    // Initial: scroll if offscreen, then settle-reposition
    scheduleRecalc(true);
    scrollSettleTimer = setTimeout(() => scheduleRecalc(false), 550);

    function onScroll() { scheduleRecalc(false); }
    function onResize() { scheduleRecalc(false); }

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });

    return () => {
      if (recalcRafRef.current !== null) {
        window.cancelAnimationFrame(recalcRafRef.current);
        recalcRafRef.current = null;
      }
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
  const ringPad = 14;
  const ringWidth = Math.max(24, targetRect.width + ringPad * 2);
  const ringHeight = Math.max(24, targetRect.height + ringPad * 2);
  const spotlightRadius = Math.max(targetRect.width, targetRect.height) * 0.72 + 42;
  const spotlightCenterX = targetRect.left + targetRect.width / 2;
  const spotlightCenterY = targetRect.top + targetRect.height / 2;
  const ringPath = makeChalkRectPath({
    width: targetRect.width,
    height: targetRect.height,
    pad: ringPad,
    wobble: 5,
  });
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
      <div
        aria-hidden
        className="guidance-backdrop"
        onClick={() => dismissCurrent()}
        style={{
          ["--cx" as string]: `${spotlightCenterX}px`,
          ["--cy" as string]: `${spotlightCenterY}px`,
          ["--r" as string]: `${spotlightRadius}px`,
        }}
      />

      {/* Chalk ring around target element */}
      <div
        aria-hidden
        className="chalk-ring"
        style={{
          position: "fixed",
          top: targetRect.top - ringPad,
          left: targetRect.left - ringPad,
          width: ringWidth,
          height: ringHeight,
          pointerEvents: "none",
          zIndex: 9998,
        }}
      >
        <svg
          className="chalk-ring-svg"
          width={ringWidth}
          height={ringHeight}
          viewBox={`0 0 ${ringWidth} ${ringHeight}`}
          preserveAspectRatio="none"
        >
          <path className="chalk-ring-path chalk-ring-path-shadow" d={ringPath} />
          <path className="chalk-ring-path chalk-ring-path-main" d={ringPath} />
          <path
            className="chalk-ring-path chalk-ring-path-secondary"
            d={ringPath}
            transform={`translate(1 1) rotate(0.4 ${ringWidth / 2} ${ringHeight / 2})`}
          />
        </svg>
      </div>

      {/* Directional arrow between card and target */}
      {cardPos && arrow ? (
        <svg
          aria-hidden
          className="chalk-arrow"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 9999,
          }}
          width="100%"
          height="100%"
          viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
          preserveAspectRatio="none"
        >
          <path d={arrow.d} className="chalk-arrow-draw" />
          <path d={arrow.d} className="chalk-arrow-soft" />
          <path d={arrow.d} className="chalk-arrow-main" />
          <path d={arrow.head} className="chalk-arrow-soft" />
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
          className="guidance-card"
          style={{
            position: "fixed",
            top: cardPos.top,
            left: cardPos.left,
            width: CARD_WIDTH,
            zIndex: 10000,
          }}
        >
          <p className="guidance-card-title">{activeStep.title}</p>
          <p id={bodyId} className="guidance-card-body">{activeStep.body}</p>
          <div className="guidance-card-actions">
            <button
              ref={firstButtonRef}
              className="guidance-btn guidance-btn-primary"
              aria-label={
                mode === "walkthrough"
                  ? hasNextStep
                    ? "Next tip"
                    : "Finish walkthrough"
                  : "Got it, dismiss hint"
              }
              onClick={
                mode === "walkthrough"
                  ? hasNextStep
                    ? advance
                    : finishWalkthrough
                  : dismissCurrent
              }
            >
              {mode === "walkthrough" ? (hasNextStep ? "Next" : "Done") : "Got it"}
            </button>
            <button
              className="guidance-btn guidance-btn-muted"
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
