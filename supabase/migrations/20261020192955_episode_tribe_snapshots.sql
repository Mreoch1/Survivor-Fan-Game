-- Append-only verified season state. Historical picks/results keep their episode context.
create table public.tribe_snapshots (
  after_episode_id integer primary key references public.episodes(id),
  phase text not null check (phase in ('tribe', 'individual')),
  tribes jsonb not null check (jsonb_typeof(tribes) = 'array' and jsonb_array_length(tribes) between 1 and 6),
  assignments jsonb not null check (jsonb_typeof(assignments) = 'object'),
  sources jsonb not null check (jsonb_typeof(sources) = 'array' and jsonb_array_length(sources) between 2 and 10),
  created_at timestamptz not null default now()
);

alter table public.tribe_snapshots enable row level security;
revoke all on public.tribe_snapshots from public, anon, authenticated, service_role;
grant select, insert on public.tribe_snapshots to service_role;

create function public.record_tribe_snapshot(
  p_after_episode_id integer,
  p_expected_previous_episode_id integer,
  p_phase text,
  p_tribes jsonb,
  p_assignments jsonb,
  p_sources jsonb
) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  latest_episode integer;
  previous_episode integer;
  existing public.tribe_snapshots%rowtype;
  recorded_individual boolean;
begin
  -- Serialize competing roster writes and hold the revealed-result context stable.
  perform pg_advisory_xact_lock(hashtext('outlast-51-tribe-snapshots'));
  lock table public.episodes in share mode;
  select max(id) into latest_episode from public.episodes
    where season = 51 and results_posted and results_published and reveal_at <= now();
  if latest_episode is null or p_after_episode_id is distinct from latest_episode then
    raise exception 'The published episode changed; reload tribe context' using errcode = '40001';
  end if;
  select coalesce(max(after_episode_id), 0) into previous_episode from public.tribe_snapshots
    where after_episode_id < p_after_episode_id;
  if p_expected_previous_episode_id is distinct from previous_episode then
    raise exception 'The previous tribe snapshot changed; reload tribe context' using errcode = '40001';
  end if;
  select exists(select 1 from public.episodes where season = 51 and id <= p_after_episode_id
    and results_posted and results_published and reveal_at <= now() and individual_game_started)
    into recorded_individual;
  if p_phase is distinct from (case when recorded_individual then 'individual' else 'tribe' end) then
    raise exception 'The phase must match the recorded individual game' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tribes) is distinct from 'array' or jsonb_typeof(p_assignments) is distinct from 'object'
    or jsonb_typeof(p_sources) is distinct from 'array' then
    raise exception 'Invalid tribe snapshot' using errcode = '22023';
  end if;
  if jsonb_array_length(p_tribes) not between 1 and 6 or jsonb_array_length(p_sources) not between 2 and 10
    or (select count(*) from jsonb_object_keys(p_assignments)) <> 21 then
    raise exception 'Invalid tribe snapshot dimensions' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_tribes) tribe
    where jsonb_typeof(tribe) <> 'object' or jsonb_typeof(tribe->'name') is distinct from 'string'
      or jsonb_typeof(tribe->'color') is distinct from 'string'
      or coalesce(tribe->>'hex', '') !~ '^#[0-9a-f]{6}$')
    or exists (select 1 from jsonb_each(p_assignments) assignment where jsonb_typeof(assignment.value) <> 'string')
    or exists (select 1 from jsonb_array_elements(p_sources) source where jsonb_typeof(source) <> 'string'
      or (source #>> '{}') !~ '^https://') then
    raise exception 'Invalid tribe snapshot values' using errcode = '22023';
  end if;
  select * into existing from public.tribe_snapshots where after_episode_id = p_after_episode_id;
  if found then
    if existing.phase = p_phase and existing.tribes = p_tribes and existing.assignments = p_assignments and existing.sources = p_sources then
      return false;
    end if;
    raise exception 'A different verified snapshot already exists' using errcode = '40001';
  end if;
  insert into public.tribe_snapshots(after_episode_id, phase, tribes, assignments, sources)
    values(p_after_episode_id, p_phase, p_tribes, p_assignments, p_sources);
  return true;
end;
$$;

revoke all on function public.record_tribe_snapshot(integer, integer, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_tribe_snapshot(integer, integer, text, jsonb, jsonb, jsonb) to service_role;
