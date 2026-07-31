export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function rectOf(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** FLIP-technique transform: given the element's First rect and Last rect,
 * returns the CSS transform that visually keeps it at First — the caller
 * then clears this transform to let it animate into Last (spec §2). */
export function deltaTransform(from: Rect, to: Rect): string {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = to.width === 0 ? 1 : from.width / to.width;
  const sy = to.height === 0 ? 1 : from.height / to.height;
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}
