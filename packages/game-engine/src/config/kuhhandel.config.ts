/**
 * Comportement du Kuhhandel en cas d'égalité (GDD §3.2.4 et §5, point 3 —
 * ambiguïté tranchée ici, car les éditions physiques varient sur ce point).
 *
 * Règle retenue :
 * - En cas d'égalité stricte entre les deux offres, une nouvelle offre
 *   secrète est redemandée aux deux joueurs (nouvelles mises).
 * - Si l'égalité persiste au bout de `TIE_BREAK_MAX_ROUNDS` tours,
 *   l'initiateur du Kuhhandel l'emporte par défaut (règle de dégagement
 *   documentée, plutôt que de bloquer indéfiniment la partie).
 */
export const KUHHANDEL_TIE_BREAK_MAX_ROUNDS = 2;
