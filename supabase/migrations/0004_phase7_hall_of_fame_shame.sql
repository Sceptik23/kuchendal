-- Phase 7 (09_IMPLEMENTATION_PLAN.md, 08_AI.md §3): Hall of Shame/Fame
-- distinctions computed at game end by packages/distinctions-engine. This
-- table only stores the outcome for display/history — the computation
-- logic itself lives in code, same pattern as badges/achievements/titles
-- (0003_phase6_meta_progression.sql).

create table public.hall_of_fame_shame_entries (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  -- Nullable: guests/bots can still be awarded a distinction for display
  -- within that game's own history, even though they have no per-user
  -- career history to attach it to.
  user_id uuid references public.users (id) on delete cascade,
  distinction_key text not null,
  computed_metric jsonb not null,
  created_at timestamptz not null default now()
);

create index hall_of_fame_shame_entries_game_id_idx on public.hall_of_fame_shame_entries (game_id);
create index hall_of_fame_shame_entries_user_id_idx on public.hall_of_fame_shame_entries (user_id);

alter table public.hall_of_fame_shame_entries enable row level security;

-- Same visibility model as game_players / user_badges: public read (it's
-- the fun end-of-game recap, meant to be shown/shared), written only by
-- the service_role (the realtime-server).
create policy "hall_of_fame_shame_entries are publicly readable"
  on public.hall_of_fame_shame_entries for select using (true);
