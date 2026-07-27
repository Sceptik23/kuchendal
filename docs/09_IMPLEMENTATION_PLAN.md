# 09 — PLAN D'IMPLÉMENTATION

> Principe directeur : chaque phase doit se terminer sur un état **testable et démontrable**, jamais sur du code à moitié branché. Ne jamais passer à la phase suivante sans que les tests de la phase courante passent.

## Phase 0 — Setup projet
- Monorepo (`/apps/web`, `/apps/realtime-server`, `/packages/game-engine`, `/packages/shared-types`, `/packages/ui`).
- Config TypeScript strict partagée, ESLint, Prettier, Vitest, Playwright.
- CI GitHub Actions (lint + test à chaque PR).
- **Livrable** : `pnpm install && pnpm test` fonctionne, projet vide mais structuré.

## Phase 1 — Moteur de règles (`game-engine`), sans réseau ni UI
- Implémenter la state machine complète décrite dans `01_GDD_GAMEPLAY.md` §7.
- Couvrir en tests unitaires : enchère complète (vente et "garde"), Kuhhandel complet (accept et contre-offre, y compris égalité), scoring de fin de partie, tous les cas limites de configuration (§5 du GDD).
- **Livrable** : le moteur peut jouer une partie complète entre "joueurs virtuels" scriptés dans un test, sans aucune interface.

## Phase 2 — Serveur temps réel minimal
- Serveur Socket.io qui expose le moteur de règles via des events réseau (cf. `03_ARCHITECTURE.md` §4-5).
- Un lobby minimal (in-memory, pas encore de persistance BDD) permettant à 2-6 clients de rejoindre une partie et de jouer via des events bruts (peu importe l'UI à ce stade, un client de test/CLI suffit).
- Test d'intégration critique : vérifier qu'une offre secrète de Kuhhandel n'est jamais visible dans le payload réseau d'un client non concerné avant le reveal.
- **Livrable** : partie jouable de bout en bout via WebSocket, testée par script, sans UI graphique.

## Phase 3 — UI de jeu minimale (Next.js)
- Écran de table de jeu fonctionnel (cf. `05_UI_UX.md` §3), connecté au serveur réel de la Phase 2.
- Pas encore de comptes persistants : pseudo temporaire à l'entrée en lobby.
- **Livrable** : 2 à 6 personnes peuvent jouer une partie complète dans un navigateur, en local ou en déploiement de test.

## Phase 4 — Comptes, auth, base de données
- Intégration Supabase (auth + tables `users`, `games`, `game_players`, `game_snapshots`, `game_events_log` — cf. `04_DATABASE.md`).
- Persistance réelle des parties, historique basique.
- **Livrable** : compte créé, connecté, partie enregistrée en base et visible dans un historique simple.

## Phase 5 — Lobby avancé + amis
- Fonctionnalités de `02_PRD_PRODUCT.md` §2-3 : amis, invitations, lobby public/privé/protégé, QR code/lien, reprise de partie sauvegardée.
- **Livrable** : parcours social complet testable entre plusieurs comptes réels.

## Phase 6 — Méta-progression (fondations)
- Moteur générique de conditions data-driven (cf. `07_META_GAME.md` §1).
- XP/niveaux, ~50 badges, ~30 succès, ~20 titres (catalogue v1).
- Profil joueur complet (cf. `02_PRD_PRODUCT.md` §4).
- **Livrable** : après une partie, XP gagné, badges éventuellement débloqués, visibles sur le profil.

## Phase 7 — Narrateur, bots, Hall of Shame/Fame
- Narrateur textuel à templates (cf. `08_AI.md` §1), bots heuristiques (§2), calcul des distinctions de fin de partie (§3-4).
- Écran de fin de partie complet avec Hall of Shame/Fame (cf. `05_UI_UX.md`).
- **Livrable** : partie avec bot(s) jouable seul/à deux, écran de fin de partie complet et amusant.

## Phase 8 — Événements rares, audio/VFX
- Bibliothèque restreinte v1 d'événements rares (~15-20) avec habillage sonore/visuel (cf. `06_AUDIO_VFX.md`, `07_META_GAME.md` §6).
- **Livrable** : événements rares se déclenchent occasionnellement en partie, sans jamais affecter le score.

## Phase 9 — Classements, polish, déploiement final
- Classements mondial/amis (cf. `02_PRD_PRODUCT.md` §8).
- Passage complet en revue UX/accessibilité de l'information cachée (cf. `05_UI_UX.md` §4).
- Déploiement Vercel final (frontend) + serveur realtime (cf. `03_ARCHITECTURE.md` §2).
- **Livrable** : produit v1 complet, déployé, conforme à la Definition of Done de `00_VISION.md`.

## Backlog post-v1 (explicitement hors périmètre initial)
- Extension du catalogue à 400+ badges / 300+ titres / 250+ événements rares.
- Classements hebdomadaire/mensuel/historique.
- Narrateur vocal (TTS).
- App mobile native, mode spectateur, voice chat, i18n.

## Règle de collaboration avec Claude Code
- Ne jamais commencer une phase avant que les tests de la phase précédente soient verts.
- Chaque phase = une ou plusieurs PR distinctes, jamais un unique commit géant.
- En cas d'ambiguïté de règle de jeu, toujours se référer à `01_GDD_GAMEPLAY.md` et, si le doute persiste, poser la question plutôt que de supposer.
