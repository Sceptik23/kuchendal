# 05 — UI/UX & DESIGN SYSTEM

## 1. Ton visuel
Ferme stylisée, chaleureuse, un peu cartoon, sans tomber dans l'enfantin — l'humour et le bluff doivent transparaître dans le design (clins d'œil, expressions des animaux, animations malicieuses). Palette terreuse et vive (vert prairie, orange grange, jaune paille) plutôt qu'un thème "jeu de société numérique" générique et froid.

## 2. Écrans principaux
1. **Accueil / Auth** — connexion, inscription, présentation rapide du jeu.
2. **Hub joueur** — profil résumé, amis en ligne, bouton "Créer une partie" / "Rejoindre".
3. **Lobby** — liste des joueurs, avatars, statut prêt/pas prêt, réglages de l'hôte, chat de lobby.
4. **Table de jeu** — écran central, cf. §3.
5. **Résolution d'enchère** — overlay/modal montrant l'historique des offres et la décision du vendeur.
6. **Résolution de Kuhhandel** — écran dédié avec zone de mise secrète (cartes face cachée pour l'adversaire, visibles pour soi).
7. **Fin de partie / Hall of Shame-Fame** — classement final + distinctions humoristiques + gains XP/badges.
8. **Profil public** — statistiques, badges, titres, historique.
9. **Classements**.
10. **Paramètres de compte**.

## 3. Écran de table de jeu — zones clés
- **Zone centrale** : carte animal en cours de révélation / enchère en cours, avec montant actuel affiché en grand.
- **Rangée des joueurs** (autour de la table, façon jeu de plateau) : avatar, pseudo, nombre de cartes animaux visibles par famille (compteurs, pas le détail exact si c'est caché), et une estimation "publique" de la richesse si le jeu choisit de la rendre partiellement visible (à trancher : en général, dans Kuhhandel, le montant exact de la main reste privé — seul le nombre de cartes peut être visible).
- **Zone perso (bas d'écran, uniquement pour le joueur courant)** : sa main d'argent (cartes visibles, sélectionnables), ses animaux possédés regroupés par espèce avec indicateur de complétion de famille.
- **Zone de mise secrète (Kuhhandel)** : interface de sélection de cartes argent à proposer, avec confirmation explicite avant envoi (pas d'envoi accidentel), et état "en attente de l'autre joueur" clair.
- **Fil de log/narrateur** : bandeau ou panneau latéral qui affiche les commentaires du narrateur et les actions récentes.
- **Chat/réactions rapides** : accessible sans quitter la vue de jeu.

## 4. Principes d'accessibilité de l'information cachée
- Distinguer visuellement en permanence trois états d'information pour chaque donnée affichée : **connue avec certitude** (ma main), **partiellement connue** (nombre de cartes d'un adversaire), **inconnue** (montant exact de la main adverse). Utiliser un langage visuel cohérent (ex. icône "?" ou flou) pour ne jamais laisser un joueur halluciner une certitude qu'il n'a pas.

## 5. Composants du design system (shadcn/ui + custom)
- `PlayingCard` (animal / argent), avec états : face visible, face cachée, sélectionnée, en cours de mise.
- `PlayerAvatarBadge` (avatar + statut + titre actif).
- `BidTicker` (historique d'enchère en direct).
- `SecretOfferTray` (plateau de composition d'offre secrète).
- `ToastNarrator` (bulle de commentaire du narrateur, cf. `08_AI.md`).
- `RewardModal` (badge/succès/titre débloqué, avec animation d'apparition).
- `HallOfShameCard` (carte de distinction humoristique de fin de partie).

## 6. Responsive
- Desktop : vue "table ronde" complète.
- Mobile : vue simplifiée en liste verticale des joueurs + zone perso fixée en bas, table de jeu accessible par scroll/swipe plutôt que tout afficher en même temps.

## 7. Animations (Framer Motion) — moments à ne pas manquer
- Révélation d'une carte animal (flip animation).
- Montée d'enchère (montant qui s'anime en incrémentant, léger effet de "tension" visuelle au-delà d'un certain montant).
- Révélation simultanée des offres secrètes de Kuhhandel (suspense : compte à rebours court avant reveal).
- Déblocage de badge/titre/niveau (célébration, confetti léger, sans être too much).
- Apparition d'un événement rare (cf. `06_AUDIO_VFX.md` et `07_META_GAME.md`).
