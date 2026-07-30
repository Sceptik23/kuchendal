/**
 * Cartes argent et mise de départ (rulebook: "Chaque joueur reçoit deux
 * cartes d'une valeur de 0 ... 4 cartes d'une valeur de 10 et une carte
 * d'une valeur de 50" = 90 par joueur).
 */
export const MONEY_DENOMINATIONS = [0, 10, 50, 100, 200, 500] as const;

export type MoneyDenomination = (typeof MONEY_DENOMINATIONS)[number];

export const STARTING_MONEY: Record<MoneyDenomination, number> = {
  0: 2,
  10: 4,
  50: 1,
  100: 0,
  200: 0,
  500: 0,
};
