import clsx from "clsx";
import React, { useEffect, useRef } from "react";

import "./Tooltip.scss";

export const getTooltipDiv = () => {
  const existingDiv = document.querySelector<HTMLDivElement>(
    ".excalidraw-tooltip",
  );
  if (existingDiv) {
    return existingDiv;
  }
  const div = document.createElement("div");
  document.body.appendChild(div);
  div.classList.add("excalidraw-tooltip");
  return div;
};

export const updateTooltipPosition = (
  tooltip: HTMLDivElement,
  item: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
  position: "bottom" | "top" = "bottom",
) => {
  const tooltipRect = tooltip.getBoundingClientRect();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const margin = 5;

  let left = item.left + item.width / 2 - tooltipRect.width / 2;
  if (left < 0) {
    left = margin;
  } else if (left + tooltipRect.width >= viewportWidth) {
    left = viewportWidth - tooltipRect.width - margin;
  }

  let top: number;

  if (position === "bottom") {
    top = item.top + item.height + margin;
    if (top + tooltipRect.height >= viewportHeight) {
      top = item.top - tooltipRect.height - margin;
    }
  } else {
    top = item.top - tooltipRect.height - margin;
    if (top < 0) {
      top = item.top + item.height + margin;
    }
  }

  Object.assign(tooltip.style, {
    top: `${top}px`,
    left: `${left}px`,
  });
};

/** ms before a `delay`ed tooltip shows */
const TOOLTIP_DELAY = 500;
/**
 * ms after a tooltip hides during which a `delay`ed tooltip shows right away
 * (e.g. when moving across adjacent buttons)
 */
const TOOLTIP_WARM_WINDOW = 300;

let showTooltipTimer = 0;
let tooltipHiddenAt = 0;
/**
 * the wrapper the visible (or pending) tooltip belongs to. All tooltips share
 * one DOM node & timer, so without an owner an unrelated wrapper unmounting
 * would cancel/hide a tooltip someone else is still hovering.
 */
let tooltipOwner: HTMLDivElement | null = null;

/** hides the tooltip & cancels a pending one, whichever wrapper owns it */
export const hideTooltip = () => {
  clearTimeout(showTooltipTimer);
  showTooltipTimer = 0;
  tooltipOwner = null;
  // a plain query, so that hiding never creates the tooltip node
  const tooltip = document.querySelector<HTMLDivElement>(".excalidraw-tooltip");
  if (tooltip?.classList.contains("excalidraw-tooltip--visible")) {
    tooltip.classList.remove("excalidraw-tooltip--visible");
    tooltipHiddenAt = Date.now();
  }
};

/** hides the tooltip only if `item` is the wrapper that owns it */
const hideTooltipOf = (item: HTMLDivElement) => {
  if (tooltipOwner === item) {
    hideTooltip();
  }
};

/**
 * hides the tooltip if its wrapper left the DOM (unmounted, or `disabled`)
 * without a pointerleave to retract it. A no-op while no tooltip is owned, so
 * that unmounting a wrapper that was never hovered doesn't touch the DOM.
 */
const hideOrphanedTooltip = () => {
  if (tooltipOwner && !tooltipOwner.isConnected) {
    hideTooltip();
  }
};

const updateTooltip = (
  item: HTMLDivElement,
  tooltip: HTMLDivElement,
  label: string,
  long: boolean,
) => {
  tooltip.classList.add("excalidraw-tooltip--visible");
  tooltip.style.minWidth = long ? "50ch" : "10ch";
  tooltip.style.maxWidth = long ? "50ch" : "15ch";

  tooltip.textContent = label;

  const itemRect = item.getBoundingClientRect();
  updateTooltipPosition(tooltip, itemRect);
};

type TooltipProps = {
  children: React.ReactNode;
  label: string;
  long?: boolean;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  /** show after a short delay (unless a tooltip was visible just now) */
  delay?: boolean;
};

export const Tooltip = ({
  children,
  label,
  long = false,
  style,
  className,
  disabled,
  delay = false,
}: TooltipProps) => {
  // a delayed tooltip shows up to TOOLTIP_DELAY after the pointer entered, by
  // which time the label may have changed
  const labelRef = useRef(label);
  labelRef.current = label;

  useEffect(() => hideOrphanedTooltip, []);

  // `disabled` removes the wrapper from the DOM without unmounting the
  // component, so no pointerleave & no effect cleanup would retract it
  useEffect(() => {
    if (disabled) {
      hideOrphanedTooltip();
    }
  }, [disabled]);

  if (disabled) {
    return null;
  }
  return (
    <div
      className={clsx("excalidraw-tooltip-wrapper", className)}
      onPointerEnter={(event) => {
        const item = event.currentTarget as HTMLDivElement;
        const show = () =>
          updateTooltip(item, getTooltipDiv(), labelRef.current, long);
        clearTimeout(showTooltipTimer);
        tooltipOwner = item;
        if (delay && Date.now() - tooltipHiddenAt > TOOLTIP_WARM_WINDOW) {
          showTooltipTimer = window.setTimeout(show, TOOLTIP_DELAY);
        } else {
          show();
        }
      }}
      onPointerLeave={(event) =>
        hideTooltipOf(event.currentTarget as HTMLDivElement)
      }
      style={style}
    >
      {children}
    </div>
  );
};
