-- Phase 6 (09_IMPLEMENTATION_PLAN.md): méta-progression — XP, badges,
-- succès, titres (07_META_GAME.md §1: catalogue data-driven, la logique de
-- déblocage vit dans packages/meta-engine, pas en SQL — ces tables ne
-- stockent que les métadonnées d'affichage et l'état "débloqué par qui").

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  rarity text not null check (
    rarity in ('commun', 'rare', 'epique', 'legendaire', 'mythique', 'secret', 'ultra_secret')
  ),
  is_secret boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references public.users (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  rarity text not null check (
    rarity in ('commun', 'rare', 'epique', 'legendaire', 'mythique', 'secret', 'ultra_secret')
  ),
  is_secret boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references public.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.titles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.user_titles (
  user_id uuid not null references public.users (id) on delete cascade,
  title_id uuid not null references public.titles (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, title_id)
);

-- The FK deferred from the Phase 4 migration (titles didn't exist yet).
alter table public.users
  add constraint users_current_title_id_fkey
  foreign key (current_title_id) references public.titles (id);

-- Cumulative cross-game stats the engine reads and updates each game
-- (packages/meta-engine CareerStats) — a single JSON blob per user rather
-- than a bespoke relational schema, since only the engine's code
-- interprets its shape.
alter table public.users add column career_stats jsonb not null default '{}'::jsonb;

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.titles enable row level security;
alter table public.user_titles enable row level security;

-- Catalogs are public reference data.
create policy "badges are publicly readable" on public.badges for select using (true);
create policy "titles are publicly readable" on public.titles for select using (true);
-- Achievements' catalog rows are readable (needed to show unlocked ones on
-- a profile) — isSecret is enforced in the UI/app layer, not by hiding the
-- catalog row itself, since a locked achievement's *name* being visible
-- once unlocked is the whole point; before unlocking, the app simply never
-- queries for it by key.
create policy "achievements are publicly readable" on public.achievements for select using (true);

-- Unlocks are public profile data (02_PRD_PRODUCT.md §4: badges/succès
-- affichés sur le profil public) — readable by anyone, written only by the
-- service_role (the realtime-server), same pattern as game_players scores.
create policy "user_badges are publicly readable" on public.user_badges for select using (true);
create policy "user_achievements are publicly readable" on public.user_achievements for select using (true);
create policy "user_titles are publicly readable" on public.user_titles for select using (true);

-- ---------------------------------------------------------------------------
-- Seed the v1 sample catalog (mirrors packages/meta-engine/src/config/*.ts —
-- keep these in sync by hand when the catalog changes; the condition LOGIC
-- lives only in code, this is display metadata).
-- ---------------------------------------------------------------------------
insert into public.badges (key, name, description, rarity, is_secret) values
  ('roi_des_vaches', 'Roi des Vaches', 'Compléter la famille Vache.', 'rare', false),
  ('le_pigeon', 'Le Pigeon', 'Acheter un animal à au moins 5x sa valeur estimée.', 'epique', false),
  ('escroc_certifie', 'Escroc certifié', 'Faire accepter une offre de Kuhhandel très défavorable à l''adversaire.', 'epique', false),
  ('millionnaire', 'Millionnaire', 'Terminer une partie avec un score élevé.', 'rare', false),
  ('faillite', 'Faillite', 'Terminer une partie sans argent.', 'commun', false),
  ('poker_face', 'Poker Face', 'Réussir 10 bluffs d''affilée.', 'legendaire', false),
  ('manipulateur', 'Manipulateur', 'Faire monter une enchère de 3 tours ou plus sans jamais l''emporter.', 'rare', false),
  ('le_banquier', 'Le Banquier', 'Encaisser un montant cumulé élevé sur une seule partie.', 'epique', false),
  ('sniper', 'Sniper', 'Compléter une famille au tout dernier tour possible.', 'epique', false),
  ('demon_des_echanges', 'Démon des échanges', 'Gagner 3 Kuhhandel consécutifs, toutes parties confondues.', 'legendaire', false),
  ('collectionneur', 'Collectionneur', 'Compléter au moins 3 familles différentes dans sa carrière.', 'rare', false),
  ('invaincu', 'Invaincu', '5 victoires consécutives.', 'legendaire', false),
  ('maitre_du_bluff', 'Maître du Bluff', 'Au moins 90% de réussite sur au moins 50 bluffs cumulés.', 'mythique', false),
  ('yolo', 'YOLO', 'Miser tout son argent sur une seule offre de Kuhhandel.', 'rare', false),
  ('legende_du_village', 'Légende du Village', 'Débloquer tous les badges disponibles.', 'secret', true);

insert into public.achievements (key, name, description, rarity, is_secret) values
  ('grand_retournement_manque', 'Grand retournement manqué', 'Perdre une partie alors qu''on était largement en tête au tour précédent.', 'rare', true),
  ('victoire_sans_marchandage', 'Victoire sans marchandage', 'Gagner une partie sans remporter un seul Kuhhandel.', 'rare', true),
  ('dernier_a_la_ferme', 'Dernier à la ferme', 'Être le dernier joueur connecté après la fin d''une partie tardive.', 'commun', true),
  ('mefiance_totale', 'Méfiance totale', 'Refuser 5 offres de Kuhhandel d''affilée dans une même partie.', 'rare', true);

insert into public.titles (key, name) values
  ('le_banquier', 'Le Banquier'),
  ('le_fermier', 'Le Fermier'),
  ('le_tricheur', 'Le Tricheur'),
  ('larnaqueur', 'L''Arnaqueur'),
  ('le_charognard', 'Le Charognard'),
  ('le_magnat', 'Le Magnat'),
  ('le_pigeon_royal', 'Le Pigeon Royal'),
  ('lempereur_des_vaches', 'L''Empereur des Vaches'),
  ('le_gourou_du_bluff', 'Le Gourou du Bluff'),
  ('le_collectionneur', 'Le Collectionneur'),
  ('le_roi_du_kuhhandel', 'Le Roi du Kuhhandel'),
  ('le_maitre_des_encheres', 'Le Maître des Enchères');
