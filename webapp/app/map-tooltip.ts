export type TooltipPosition = { left: number; top: number };

export function positionTooltip(
  pointerX: number,
  pointerY: number,
  containerWidth: number,
  containerHeight: number,
  tooltipWidth: number,
  tooltipHeight: number,
  gap = 8,
): TooltipPosition {
  const preferredLeft = pointerX + gap + tooltipWidth <= containerWidth - gap
    ? pointerX + gap
    : pointerX - tooltipWidth - gap;
  const preferredTop = pointerY - tooltipHeight - gap >= gap
    ? pointerY - tooltipHeight - gap
    : pointerY + gap;

  return {
    left: Math.min(Math.max(preferredLeft, gap), Math.max(gap, containerWidth - tooltipWidth - gap)),
    top: Math.min(Math.max(preferredTop, gap), Math.max(gap, containerHeight - tooltipHeight - gap)),
  };
}
