# 00 — VISION

## Nom de code du projet
**Kuchendal** (renommé depuis "Kuhhandel Online" pour éviter tout conflit avec la marque déposée du jeu physique).

## Pitch en une phrase
Un jeu d'enchères, de bluff et de négociation multijoueur en temps réel, fidèle aux règles du Kuhhandel original, habillé d'une couche de méta-progression complète (comptes, amis, XP, badges, titres, événements rares, Hall of Shame/Fame) pour donner envie de rejouer indéfiniment.

## Ce que le jeu N'EST PAS
- Ce n'est pas un jeu de cartes à collectionner avec des mécaniques inventées : les règles du cœur de jeu (enchères + Kuhhandel) doivent rester fidèles à l'original.
- Ce n'est pas un jeu solo : le multijoueur temps réel est au centre de l'expérience dès le premier prototype.
- Ce n'est pas un simple portage : la couche progression/social est un pilier du produit, pas un bonus ajouté après coup.

## Piliers d'expérience
1. **Fidélité aux règles** — Un joueur qui connaît le jeu physique doit reconnaître immédiatement toutes les mécaniques.
2. **Lisibilité de l'information cachée** — L'UI doit rendre visible ce qui est su et ce qui est deviné (argent, animaux, historique des achats des autres).
3. **Tension sociale** — Chat, réactions, emotes, et surtout la mécanique du Kuhhandel (offre secrète) doivent faire ressentir le bluff, pas seulement le simuler.
4. **Boucle de rétention** — Après chaque partie, il doit toujours rester quelque chose à débloquer (badge, titre, succès caché, événement rare, classement à grimper).
5. **Humour et mémorabilité** — Le Hall of Shame/Fame et le narrateur IA doivent produire des moments qu'on raconte à ses amis.

## Public cible
- Groupes d'amis (4 à 6 joueurs typiquement) jouant à distance ou en soirée.
- Joueurs de jeux de société "digitaux" (type Skull, Codenames, Among Us) cherchant un jeu à forte interaction sociale.
- Format de session : 20 à 45 minutes par partie.

## Plateformes
- Web responsive en priorité (desktop + mobile navigateur).
- Déploiement cible : Vercel.
- Pas d'app native dans une v1 — le PWA peut être une évolution.

## Contraintes de projet
- Développement piloté par Claude Code, en français dans les commentaires de specs, code en anglais (convention standard).
- Projet découpé en phases livrables indépendamment testables (voir `09_IMPLEMENTATION_PLAN.md`) — pas de "big bang" en une seule passe.
- Chaque document de ce dossier `/docs` fait foi ; en cas de conflit, `01_GDD_GAMEPLAY.md` (les règles du jeu) est toujours prioritaire sur tout le reste.

## Definition of Done du projet (v1)
- 2 à 6 joueurs peuvent créer un lobby, jouer une partie complète de Kuhhandel avec les règles officielles, et voir un écran de fin de partie avec récompenses.
- Comptes joueurs persistants avec au moins : historique de parties, XP, niveau, 1 système de classement.
- Au moins 50 badges, 30 succès et 20 titres implémentés (le document `07_META_GAME.md` liste les catalogues complets à cibler à terme).
- Hall of Shame/Fame généré automatiquement en fin de partie.
- Déployé et jouable en ligne sur Vercel.
