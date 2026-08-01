import { rectOf, type Rect } from "@kuhhandel/ui";

const cardEls = new Map<string, HTMLElement>();
const playerSlotEls = new Map<string, HTMLElement>();

/** Registers (or clears, on unmount) the DOM node currently rendering a
 * given card id, so a transfer animation elsewhere can look up its exact
 * on-screen position without prop-drilling refs through every panel. */
export function registerCardPosition(id: string, el: HTMLElement | null): void {
  if (el) cardEls.set(id, el);
  else cardEls.delete(id);
}

export function getCardRect(id: string): Rect | null {
  const el = cardEls.get(id);
  return el ? rectOf(el) : null;
}

/** Registers a per-player "slot" DOM node (self-rail or opponent card) used
 * as a transfer destination/source when the exact moved card isn't (yet)
 * individually rendered for that player — e.g. an opponent's hidden money. */
export function registerPlayerSlot(playerId: string, el: HTMLElement | null): void {
  if (el) playerSlotEls.set(playerId, el);
  else playerSlotEls.delete(playerId);
}

export function getPlayerSlotRect(playerId: string): Rect | null {
  const el = playerSlotEls.get(playerId);
  return el ? rectOf(el) : null;
}
