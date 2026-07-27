import { xpCostForLevel } from "./config/xp.config.js";

export function xpThresholdForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) {
    total += xpCostForLevel(n);
  }
  return total;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpThresholdForLevel(level + 1)) {
    level += 1;
  }
  return level;
}
