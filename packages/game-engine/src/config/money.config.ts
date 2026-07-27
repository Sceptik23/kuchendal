/**
 * Cartes argent et mise de départ (GDD §1.2 et §5, point 2 — ambiguïté tranchée ici).
 * Les "0" existent uniquement pour bluffer (GDD §1.2).
 */
export const MONEY_DENOMINATIONS = [0, 10, 50, 100, 200, 500] as const;

export type MoneyDenomination = (typeof MONEY_DENOMINATIONS)[number];

/**
 * Répartition de la mise de départ par joueur : 2x0, 4x10, 1x50, 2x100, 1x200 = 570.
 * Choix arbitraire, à ajuster en playtest ; conservé constant quel que soit le
 * nombre de joueurs (le jeu physique original varie peu sur ce point).
 */
export const STARTING_MONEY: Record<MoneyDenomination, number> = {
  0: 2,
  10: 4,
  50: 1,
  100: 2,
  200: 1,
  500: 0,
};
