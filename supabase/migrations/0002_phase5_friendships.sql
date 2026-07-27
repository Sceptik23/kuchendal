-- Phase 5 (09_IMPLEMENTATION_PLAN.md): amis, lobby avancé.
-- Schéma tiré de 04_DATABASE.md §2 (friendships) et 02_PRD_PRODUCT.md §2.

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.users (id) on delete cascade,
  user_b_id uuid not null references public.users (id) on delete cascade,
  -- Who actually sent the request — user_a_id/user_b_id are just a
  -- canonical (smaller-id-first) ordering to enforce one row per pair,
  -- they do NOT indicate who initiated it.
  requested_by uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_distinct_users check (user_a_id <> user_b_id),
  -- One relationship row per unordered pair: always store with the smaller
  -- id first so (a, b) and (b, a) requests can't create duplicate rows.
  constraint friendships_ordered_pair check (user_a_id < user_b_id),
  constraint friendships_requester_is_a_party check (
    requested_by = user_a_id or requested_by = user_b_id
  ),
  unique (user_a_id, user_b_id)
);

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

create index friendships_user_a_id_idx on public.friendships (user_a_id);
create index friendships_user_b_id_idx on public.friendships (user_b_id);

alter table public.friendships enable row level security;

-- Either party can see the relationship (needed to render "pending request
-- from X" on both ends, and the accepted friends list).
create policy "friendships are readable by either party"
  on public.friendships for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Sending a request: the requester must be one of the two parties, and the
-- row must start out pending (you can't insert a pre-accepted friendship).
create policy "users can send a friend request"
  on public.friendships for insert
  with check (
    auth.uid() = requested_by
    and (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and status = 'pending'
  );

-- Responding to a request (accept/block) or removing a friendship: either
-- party may update their shared row.
create policy "either party can update the friendship"
  on public.friendships for update
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

create policy "either party can delete the friendship"
  on public.friendships for delete
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);
