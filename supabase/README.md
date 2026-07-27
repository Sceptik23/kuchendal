# Supabase — Phase 4

## Décisions de configuration (04_DATABASE.md §4)

- **Rétention de `game_events_log`** : conservation illimitée pour l'instant (pas de purge automatique). À revoir si le volume de stockage devient un problème une fois le jeu en production — ajouter alors un job de purge après N mois, sans changer le schéma.
- **Format de `ruleset_config`** : objet JSON reprenant 1:1 les clés exportées par `packages/game-engine/src/config/*.config.ts` (species, money, kuhhandel, game). Un snapshot de la config utilisée est stocké par partie pour permettre de rejouer/analyser une partie même si les valeurs par défaut changent plus tard.

## Comment appliquer cette migration

1. Crée un projet sur https://supabase.com (voir les instructions données dans la conversation).
2. Dans le dashboard du projet, va dans **SQL Editor**.
3. Colle le contenu de `migrations/0001_phase4_accounts_and_games.sql` et exécute-le.
   - (Alternative si tu installes la Supabase CLI : `supabase link --project-ref <ref>` puis `supabase db push`.)
4. Récupère dans **Project Settings → API** :
   - `Project URL`
   - `anon public` key (utilisée côté client Next.js)
   - `service_role` key (utilisée uniquement côté serveur — realtime-server et API routes — jamais exposée au navigateur)
5. Crée un fichier `.env.local` (non commité, voir `.gitignore`) dans `apps/web` et un `.env` dans `apps/realtime-server` avec ces valeurs (noms de variables à confirmer une fois l'intégration client écrite).

## Ce qui est volontairement absent de cette migration

- `friendships` (Phase 5), `badges`/`user_badges`, `achievements`/`user_achievements`, `titles`/`user_titles` (Phase 6), `hall_of_fame_shame_entries` (Phase 7), `leaderboards` (Phase 9) : chacune arrivera dans sa propre migration au moment de sa phase, pour ne jamais avoir de schéma à moitié utilisé.
