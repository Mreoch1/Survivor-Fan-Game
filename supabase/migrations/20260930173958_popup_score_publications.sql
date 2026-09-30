-- A receipt is committed only with the complete cached-score refresh. Historical
-- popup results then stop causing full profile/pick scans on ordinary page reads.
create table public.popup_score_publications (
  question_id uuid primary key references public.popup_questions(id),
  published_at timestamptz not null default clock_timestamp()
);
alter table public.popup_score_publications enable row level security;
revoke all on public.popup_score_publications from public, anon, authenticated, service_role;
grant select, insert on public.popup_score_publications to service_role;

create view public.pending_popup_score_publications with (security_invoker = true) as
select q.id as question_id,
  greatest(q.reveal_at, q.resolved_at, q.closes_at, e.reveal_at) as available_at
from public.popup_questions q
join public.episodes e on e.id = q.resolution_episode_id
where q.status in ('resolved', 'void') and q.reveal_at is not null and q.resolved_at is not null
  and e.results_published
  and not exists (select 1 from public.popup_score_publications p where p.question_id = q.id);
revoke all on public.pending_popup_score_publications from public, anon, authenticated, service_role;
grant select on public.pending_popup_score_publications to service_role;

-- The application still calculates scores using the shared scorer. Only this
-- commit step is atomic, so write failures leave both scores and receipts retryable.
create function public.apply_published_scores(
  p_profile_scores jsonb, p_streak_scores jsonb, p_question_ids uuid[],
  p_episode_ids integer[], p_scored_at timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  score record;
  current_profile public.profiles%rowtype;
  expected_episodes integer[];
  profile_ids uuid[];
  expected_profiles uuid[];
begin
  if p_profile_scores is null or jsonb_typeof(p_profile_scores) <> 'array'
    or p_streak_scores is null or jsonb_typeof(p_streak_scores) <> 'array'
    or p_question_ids is null or p_episode_ids is null or p_scored_at is null or not isfinite(p_scored_at) then
    raise exception 'A complete score snapshot is required' using errcode = '22023';
  end if;
  -- Every score refresh uses the same short transaction lock, including manual refreshes.
  perform pg_advisory_xact_lock(5171, 51);
  if exists (select 1 from public.popup_score_publications p where not (p.question_id = any(p_question_ids))) then
    -- A newer popup snapshot already won. Do not let this older request overwrite it.
    return false;
  end if;
  if exists (
    select 1 from unnest(p_question_ids) snapshot(id)
    left join public.popup_questions q on q.id = snapshot.id
    left join public.episodes e on e.id = q.resolution_episode_id
    where q.id is null or q.status not in ('resolved', 'void') or q.reveal_at is null or q.resolved_at is null
      or e.id is null or not e.results_published
      or greatest(q.reveal_at, q.resolved_at, q.closes_at, e.reveal_at) > least(p_scored_at, clock_timestamp())
  ) then
    raise exception 'An unrevealed popup cannot be published' using errcode = '23514';
  end if;
  select coalesce(array_agg(id order by id), '{}'::integer[]) into expected_episodes
    from public.episodes where results_published and reveal_at <= clock_timestamp();
  if expected_episodes is distinct from (select coalesce(array_agg(id order by id), '{}'::integer[]) from unnest(p_episode_ids) snapshot(id)) then
    raise exception 'Published episodes changed during score calculation; retry' using errcode = '40001';
  end if;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into expected_profiles
    from public.profiles where league_joined_at is not null;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into profile_ids
    from jsonb_to_recordset(p_profile_scores) as s(id uuid);
  if profile_ids is distinct from expected_profiles then
    raise exception 'League members changed during score calculation; retry' using errcode = '40001';
  end if;
  -- Lock and validate every season-pick input before changing any cached score.
  for score in select * from jsonb_to_recordset(p_profile_scores) as s(
    id uuid, individual_game_pick text, endgame_pick text, endgame_pick_switched boolean
  ) order by id loop
    select * into current_profile from public.profiles where id = score.id for update;
    if not found or current_profile.league_joined_at is null
      or row(current_profile.individual_game_pick, current_profile.endgame_pick, current_profile.endgame_pick_switched)
        is distinct from row(score.individual_game_pick, score.endgame_pick, score.endgame_pick_switched) then
      raise exception 'Season picks changed during score calculation; retry' using errcode = '40001';
    end if;
  end loop;
  update public.picks p set streak_point = s.streak_point
    from jsonb_to_recordset(p_streak_scores) as s(id bigint, streak_point integer)
    where p.id = s.id and p.streak_point is distinct from s.streak_point;
  update public.profiles p set total_points = s.total_points, preseason_points = s.preseason_points,
    individual_game_points = s.individual_game_points, endgame_points = s.endgame_points,
    immunity_streak = s.immunity_streak, longest_streak = s.longest_streak, updated_at = clock_timestamp()
    from jsonb_to_recordset(p_profile_scores) as s(id uuid, total_points numeric, preseason_points numeric,
      individual_game_points numeric, endgame_points numeric, immunity_streak integer, longest_streak integer)
    where p.id = s.id and row(p.total_points, p.preseason_points, p.individual_game_points,
      p.endgame_points, p.immunity_streak, p.longest_streak) is distinct from row(s.total_points,
      s.preseason_points, s.individual_game_points, s.endgame_points, s.immunity_streak, s.longest_streak);
  -- These IDs are the exact revealed loader snapshot, never a fresh broad query.
  insert into public.popup_score_publications(question_id)
    select id from unnest(p_question_ids) snapshot(id) on conflict (question_id) do nothing;
  return true;
end;
$$;
revoke all on function public.apply_published_scores(jsonb, jsonb, uuid[], integer[], timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.apply_published_scores(jsonb, jsonb, uuid[], integer[], timestamptz) to service_role;
