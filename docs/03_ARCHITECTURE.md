# 03 — ARCHITECTURE TECHNIQUE

## 1. Stack retenue
- **Framework** : Next.js (App Router) + TypeScript strict.
- **Temps réel** : Socket.io (serveur Node dédié, séparé ou intégré selon contraintes Vercel — voir §4).
- **Base de données** : PostgreSQL via Supabase (auth, DB, storage des avatars).
- **État client** : Zustand pour l'état de jeu local/UI, React Query pour les données serveur (profil, classements, historique).
- **UI** : Tailwind CSS + shadcn/ui comme socle de composants.
- **Animations** : Framer Motion.
- **Déploiement** : Vercel (frontend + API routes), serveur Socket.io hébergé séparément si nécessaire (voir contrainte ci-dessous).
- **Tests** : Vitest (unitaire, en particulier le moteur de règles), Playwright (E2E sur les parcours critiques).
- **CI/CD** : GitHub Actions → build + tests → déploiement Vercel automatique sur `main`.

## 2. Contrainte critique Vercel + WebSocket
Vercel ne supporte pas nativement des connexions WebSocket persistantes de longue durée sur ses fonctions serverless classiques. Deux options à trancher **avant de commencer le développement réseau** :
- **Option A (recommandée pour la v1)** : héberger le serveur Socket.io séparément (ex. Railway, Fly.io, Render) et ne laisser sur Vercel que le frontend + les API routes REST (auth, profils, classements).
- **Option B** : utiliser une solution managée compatible edge (ex. Pusher, Ably, ou les Vercel Realtime/Edge Functions si le besoin est simple) en remplacement de Socket.io.

Ce document part sur l'**Option A** par défaut. Si l'implémentation choisit l'Option B, le protocole réseau décrit ci-dessous (§4 et §5) doit être adapté en conséquence, mais la logique de jeu (moteur pur, sans dépendance réseau) reste identique.

## 3. Séparation des responsabilités (couches)
```
/apps
  /web            → Next.js (UI, pages, composants, API routes REST)
  /realtime-server → Serveur Socket.io autonome (Node/TS)
/packages
  /game-engine    → Moteur de règles PUR (aucune dépendance réseau ni UI) — cf. 01_GDD_GAMEPLAY.md
  /shared-types   → Types TypeScript partagés (état de jeu, events, DTO)
  /ui             → Composants UI réutilisables (design system, cf. 05_UI_UX.md)
```
Le `game-engine` doit être testable à 100% en isolation (tests unitaires purs, sans mock réseau), car c'est la pièce la plus critique du produit : toute la crédibilité du jeu repose sur la fidélité des règles.

## 4. Modèle de state management du jeu
- Le **serveur** est la seule source de vérité de l'état de partie (autorité serveur, pas de logique de règles côté client).
- Le client reçoit des **diffs d'état** ou des **events** via Socket.io et met à jour un store Zustand local en lecture seule vis-à-vis des règles (le client ne fait que proposer des actions, jamais appliquer lui-même une transition d'état de jeu).
- Chaque action joueur (enchérir, passer, lancer un Kuhhandel, faire une offre secrète) est envoyée au serveur sous forme d'un event typé, validée par le moteur de règles côté serveur, puis diffusée aux clients concernés.

## 5. Gestion de l'information cachée (offres secrètes du Kuhhandel)
Point d'architecture sensible : les offres secrètes ne doivent **jamais transiter en clair vers les clients qui ne doivent pas les voir**, même dans le payload réseau (pas de "cacher côté UI seulement"). Le serveur ne révèle une offre à l'ensemble des joueurs qu'au moment officiel de la résolution (`REVEAL`). Ceci doit être testé explicitement (test d'intégration : un client ne doit jamais recevoir dans son payload réseau une donnée qu'il n'est pas censé connaître).

## 6. Reconnexion / persistance de partie
- Chaque partie a un identifiant persistant en base ; l'état de jeu est sérialisé régulièrement (snapshot) pour permettre :
  - la reconnexion d'un joueur qui perd sa connexion,
  - la reprise d'une partie sauvegardée par l'hôte (cf. PRD §3 Lobby).
- Timeout configurable par joueur (ex. si un joueur ne répond pas dans un délai donné lors d'une offre secrète, un comportement par défaut doit être défini — ex. offre "0" automatique ou passe automatique — à documenter et rendre visible aux autres joueurs pour la transparence).

## 7. Sécurité / anti-triche
- Aucune donnée de jeu sensible (main d'un joueur, offre secrète en cours) n'est envoyée aux autres clients avant résolution officielle.
- Validation systématique côté serveur de toute action (un client malveillant ne doit jamais pouvoir forcer une transition d'état invalide).
- Rate limiting sur les API d'authentification et sur les actions de jeu (anti-spam).

## 8. Observabilité
- Logs structurés des transitions de state machine (utile pour debug et pour calculer les statistiques du Hall of Shame/Fame, cf. `08_AI.md`).
- Un log d'audit de partie (append-only) permet de reconstruire une partie a posteriori pour l'historique et les statistiques avancées, sans nécessiter de vrai "replay" visuel en v1.
