-- Phase 4 (09_IMPLEMENTATION_PLAN.md): comptes, auth, persistance des parties.
-- Schéma conceptuel tiré de 04_DATABASE.md §2 — uniquement les tables
-- nécessaires à cette phase (users, games, game_players, game_snapshots,
-- game_events_log). friendships (Phase 5), badges/achievements/titles
-- (Phase 6), hall_of_fame_shame_entries (Phase 7) et leaderboards (Phase 9)
-- arriveront dans des migrations dédiées à leur phase respective.

create extension if not exists "pgcrypto";

-- Maintains `updated_at` automatically on any row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users: extends auth.users (Supabase Auth) with the public profile fields
-- listed in 02_PRD_PRODUCT.md §1 and 04_DATABASE.md.
-- `current_title_id` has no FK constraint yet — `titles` doesn't exist until
-- the Phase 6 migration, which will add the constraint via ALTER TABLE.
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
  favorite_color text,
  level int not null default 1,
  xp int not null default 0,
  current_title_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-provision a public.users row when someone signs up via Supabase Auth.
-- Expects the client to pass `username` in the signUp `options.data` payload.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', 'player_' || substr(new.id::text, 1, 8)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;

-- Public profiles (02_PRD_PRODUCT.md §4): anyone can read any profile.
create policy "users are publicly readable"
  on public.users for select
  using (true);

-- Only the owner can edit their own profile fields.
create policy "users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'lobby'
    check (status in ('lobby', 'in_progress', 'finished', 'abandoned')),
  ruleset_config jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  host_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger games_set_updated_at
  before update on public.games
  for each row execute function public.set_updated_at();

alter table public.games enable row level security;

-- Public/private/password-protected lobby distinctions (02_PRD_PRODUCT.md §3)
-- are enforced at the application layer via ruleset_config; at the DB level
-- game rows themselves are readable by anyone (needed for lobby browsing and
-- match history) but only the host can create or update the game record.
create policy "games are publicly readable"
  on public.games for select
  using (true);

create policy "hosts can create their own game"
  on public.games for insert
  with check (auth.uid() = host_user_id);

create policy "hosts can update their own game"
  on public.games for update
  using (auth.uid() = host_user_id);

-- ---------------------------------------------------------------------------
-- game_players
-- ---------------------------------------------------------------------------
create table public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid references public.users (id),
  is_bot boolean not null default false,
  final_score int,
  final_rank int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create trigger game_players_set_updated_at
  before update on public.game_players
  for each row execute function public.set_updated_at();

create index game_players_user_id_game_id_idx on public.game_players (user_id, game_id);

alter table public.game_players enable row level security;

-- Readable by anyone (match history, stats). Writes (scores, ranks) are only
-- ever performed by the trusted realtime-server using the service_role key,
-- which bypasses RLS entirely — no insert/update policy is defined for
-- anon/authenticated roles on purpose.
create policy "game_players are publicly readable"
  on public.game_players for select
  using (true);

-- ---------------------------------------------------------------------------
-- game_snapshots — full serialized engine state for reconnection/resume
-- (03_ARCHITECTURE.md §6). Never exposed to clients directly: a mid-game
-- snapshot can contain other players' private hands. Only the service role
-- (the realtime-server) may read or write these rows.
-- ---------------------------------------------------------------------------
create table public.game_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  turn_number int not null,
  state_jsonb jsonb not null,
  created_at timestamptz not null default now()
);

create index game_snapshots_game_id_idx on public.game_snapshots (game_id);

alter table public.game_snapshots enable row level security;
-- No policies: default-deny for anon/authenticated. service_role bypasses RLS.

-- ---------------------------------------------------------------------------
-- game_events_log — append-only audit log (03_ARCHITECTURE.md §8), feeds
-- Hall of Shame/Fame and stats computation (08_AI.md). Past, already-
-- resolved events are not secret (the reveal already happened in-game), so
-- this is readable by anyone; only the service role may append to it.
-- ---------------------------------------------------------------------------
create table public.game_events_log (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index game_events_log_game_id_idx on public.game_events_log (game_id);

alter table public.game_events_log enable row level security;

create policy "game_events_log is publicly readable"
  on public.game_events_log for select
  using (true);
