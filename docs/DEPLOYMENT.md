# Déploiement (Phase 9)

> `03_ARCHITECTURE.md` §2 retient l'Option A : Vercel ne supporte pas des
> WebSocket persistants sur ses fonctions serverless, donc le frontend et le
> serveur temps réel se déploient sur deux hébergeurs séparés.

## 1. Frontend (`apps/web`) sur Vercel

1. Connecte le repo GitHub à un nouveau projet Vercel.
2. Dans **Project Settings → General → Root Directory**, choisis `apps/web`
   (Vercel détecte automatiquement pnpm via `pnpm-lock.yaml` à la racine du
   monorepo et Next.js dans ce dossier — aucune configuration de build
   supplémentaire n'est nécessaire).
3. Dans **Project Settings → Environment Variables**, ajoute :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_REALTIME_URL` — l'URL publique du serveur temps réel une
     fois déployé (étape 2 ci-dessous). Tant qu'il n'est pas déployé, le
     frontend pointera vers `http://localhost:4000` par défaut (cf.
     `apps/web/lib/socket.ts`).
4. Déploie. Vérifie que `pnpm build` passe déjà en local avant de déployer
   (`pnpm --filter @kuhhandel/web build`) — c'est le cas au moment où ce
   document est écrit.

## 2. Serveur temps réel (`apps/realtime-server`)

Recommandé (Option A) : un hébergeur qui supporte des process long-lived
(Railway, Fly.io ou Render — le projet ne dépend d'aucun d'entre eux
spécifiquement).

Exemple avec Railway :
1. Nouveau projet → déployer depuis le repo GitHub.
2. **Root Directory** : `apps/realtime-server`.
3. **Build command** : `pnpm install --frozen-lockfile && pnpm --filter @kuhhandel/realtime-server... build`
   (le `...` inclut les packages internes dont il dépend :
   `game-engine`, `meta-engine`, `shared-types`, `bot-engine`,
   `narrator-engine`, `rare-events-engine`, `distinctions-engine`).
4. **Start command** : `pnpm --filter @kuhhandel/realtime-server start`
   (lance `node dist/index.js`, cf. `apps/realtime-server/package.json`).
5. Variables d'environnement (mêmes noms que `apps/realtime-server/.env`
   en local) :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (⚠️ jamais côté client/web)
   - `SUPABASE_ANON_KEY`
   - `PORT` (Railway/Fly/Render l'injectent généralement automatiquement —
     vérifier que `apps/realtime-server/src/index.ts` lit bien la variable
     fournie par l'hébergeur).
6. Une fois déployé, récupère l'URL publique (ex. `https://xxx.up.railway.app`)
   et renseigne-la comme `NEXT_PUBLIC_REALTIME_URL` côté Vercel (étape 1).

### Point de vigilance sécurité avant mise en ligne publique
`apps/realtime-server` lit une variable d'environnement `CORS_ORIGIN` pour
la config CORS de Socket.io (défaut `"*"`, pratique en dev). Avant un
déploiement public, ajoute `CORS_ORIGIN=https://<ton-domaine-vercel>` dans
les variables d'environnement de l'hébergeur choisi, pour qu'un site tiers
ne puisse pas ouvrir de connexions vers le serveur de jeu.

## 3. Base de données

Les 4 migrations dans `supabase/migrations/` doivent déjà être appliquées
(voir `supabase/README.md` — copier/coller dans le SQL Editor du dashboard
Supabase, une par une, dans l'ordre numérique) :
- `0001_phase4_accounts_and_games.sql`
- `0002_phase5_friendships.sql`
- `0003_phase6_meta_progression.sql`
- `0004_phase7_hall_of_fame_shame.sql`

## 4. CI/CD

`.github/workflows/ci.yml` fait déjà lint + typecheck + test sur chaque PR
et push vers `main`. Le déploiement automatique sur push est ensuite pris en
charge nativement par Vercel (intégration GitHub) et par l'hébergeur choisi
pour `apps/realtime-server` (la plupart des options ci-dessus supportent un
déploiement automatique sur push vers `main` une fois le repo connecté).

## 5. Ce qui reste un choix humain, pas une action automatisable
- Créer les comptes Vercel / Railway (ou équivalent) et connecter le repo.
- Renseigner les vraies valeurs de secrets (clés Supabase, URL du serveur
  temps réel) dans les interfaces de ces hébergeurs.
- Décider du nom de domaine final (00_VISION.md rappelle que "Kuhhandel
  Online" est un nom de travail à changer avant publication réelle, pour
  éviter tout conflit avec la marque déposée du jeu physique).
