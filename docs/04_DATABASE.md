# 04 — BASE DE DONNÉES

## 1. Principes
- PostgreSQL (Supabase). Toutes les tables ont `id uuid default gen_random_uuid()`, `created_at`, `updated_at`.
- Les données de partie *en cours* (état de jeu temps réel) vivent en mémoire côté serveur realtime, avec snapshot périodique en base pour la reprise (voir `03_ARCHITECTURE.md` §6). La base n'est pas sollicitée à chaque micro-action de jeu.
- Row Level Security (RLS) Supabase activée sur toutes les tables contenant des données utilisateur.

## 2. Schéma — tables principales (vue conceptuelle, à raffiner en migrations SQL réelles)

### `users`
| colonne | type | notes |
|---|---|---|
| id | uuid | PK |
| username | text unique | |
| password_hash | text | jamais en clair |
| email | text nullable | |
| avatar_url | text | |
| favorite_color | text | |
| level | int | défaut 1 |
| xp | int | défaut 0 |
| current_title_id | uuid FK → titles | nullable |

### `friendships`
| colonne | type | notes |
|---|---|---|
| id | uuid | PK |
| user_a_id | uuid FK users | |
| user_b_id | uuid FK users | |
| status | enum(pending, accepted, blocked) | |

### `games`
| colonne | type | notes |
|---|---|---|
| id | uuid | PK |
| status | enum(lobby, in_progress, finished, abandoned) | |
| ruleset_config | jsonb | snapshot de la config de règles utilisée (cf. `01_GDD_GAMEPLAY.md` §5) |
| started_at / finished_at | timestamp | |
| host_user_id | uuid FK users | |

### `game_players`
| colonne | type | notes |
|---|---|---|
| game_id | uuid FK games | |
| user_id | uuid FK users | nullable si bot |
| is_bot | bool | |
| final_score | int | nullable tant que la partie n'est pas finie |
| final_rank | int | |

### `game_snapshots`
| colonne | type | notes |
|---|---|---|
| game_id | uuid FK games | |
| turn_number | int | |
| state_jsonb | jsonb | état complet sérialisé du moteur (pour reprise/reconnexion) |

### `game_events_log`
| colonne | type | notes |
|---|---|---|
| game_id | uuid FK games | |
| event_type | text | ex. `AUCTION_RESOLVED`, `KUHHANDEL_RESOLVED` |
| payload | jsonb | |
| occurred_at | timestamp | |

Ce log alimente les calculs du Hall of Shame/Fame et les statistiques avancées (cf. `08_AI.md`) sans dupliquer la logique de scoring ailleurs.

### `badges` / `user_badges`
- `badges` : catalogue statique (nom, description, icône, rareté, condition — condition stockée comme identifiant de règle, la logique de déblocage vit dans le code, pas en SQL).
- `user_badges` : `user_id`, `badge_id`, `unlocked_at`.

### `achievements` / `user_achievements`
- Même modèle que badges, avec un flag `is_secret` (masqué tant que non débloqué).

### `titles` / `user_titles`
- Catalogue de titres + table de liaison utilisateur.

### `leaderboards` (vue matérialisée ou table calculée périodiquement)
- Recalculée par job planifié (cron Vercel ou worker externe), pas en temps réel synchrone, pour éviter la charge sur chaque fin de partie.

### `hall_of_fame_shame_entries`
| colonne | type | notes |
|---|---|---|
| game_id | uuid FK games | |
| user_id | uuid FK users | |
| distinction_key | text | ex. `pigeon_cosmique` |
| computed_metric | jsonb | valeur ayant justifié la distinction, pour affichage |

## 3. Index et performance
- Index sur `username` (recherche d'amis).
- Index composite sur `(user_id, game_id)` pour l'historique de parties.
- Index sur `leaderboards(category, scope, period)` pour les requêtes de classement.

## 4. Décisions à trancher avant migration finale
- Politique de rétention du `game_events_log` (conservation illimitée vs purge après N mois) — impact stockage à surveiller si le jeu grossit.
- Format exact du `ruleset_config` (doit correspondre 1:1 aux paramètres listés dans `01_GDD_GAMEPLAY.md` §5).
