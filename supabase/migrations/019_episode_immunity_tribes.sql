-- Multiple immunity-winning tribes per episode: +1 for any picked tribe that won.
create table if not exists public.episode_immunity_tribes (
  episode_id uuid not null references public.episodes (id) on delete cascade,
  tribe_id text not null,
  primary key (episode_id, tribe_id)
);

comment on table public.episode_immunity_tribes is 'Tribes that won immunity this episode (1–3). User picks matching any row get +1 tribe_immunity_points when episode is processed.';

alter table public.episode_immunity_tribes enable row level security;
create policy "Episode immunity tribes read" on public.episode_immunity_tribes for select to authenticated using (true);
create policy "Episode immunity tribes admin" on public.episode_immunity_tribes for all using (public.is_admin());

-- Backfill from existing data: ep1 Vatu; ep2 Kalo + Vatu; ep3 Cila + Kalo
insert into public.episode_immunity_tribes (episode_id, tribe_id)
select e.id, e.immunity_winning_tribe_id
from public.episodes e
where e.season = 50 and e.immunity_winning_tribe_id is not null
on conflict (episode_id, tribe_id) do nothing;

insert into public.episode_immunity_tribes (episode_id, tribe_id)
select e.id, t
from public.episodes e,
     unnest(array['kalo','vatu']::text[]) as t
where e.season = 50 and e.episode_number = 2
on conflict (episode_id, tribe_id) do nothing;

insert into public.episode_immunity_tribes (episode_id, tribe_id)
select e.id, t
from public.episodes e,
     unnest(array['cila','kalo']::text[]) as t
where e.season = 50 and e.episode_number = 3
on conflict (episode_id, tribe_id) do nothing;
