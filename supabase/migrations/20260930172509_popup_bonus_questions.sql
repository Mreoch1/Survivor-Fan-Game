-- Occasional, separately scored questions. Browsers never read these tables or RPCs.
create table public.popup_questions (
  id uuid primary key,
  question text not null check (char_length(question) between 1 and 400 and char_length(btrim(question)) > 0),
  details text not null default '' check (char_length(details) <= 2000),
  credit_name text not null default '' check (char_length(credit_name) <= 100),
  opens_at timestamptz not null check (isfinite(opens_at)),
  closes_at timestamptz not null check (isfinite(closes_at)),
  points integer not null default 3 check (points = 3),
  status text not null default 'open' check (status in ('open', 'resolved', 'void')),
  correct_answer text check (correct_answer in ('Yes', 'No')),
  resolution_episode_id integer references public.episodes(id),
  reveal_at timestamptz check (isfinite(reveal_at)),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  constraint popup_question_window check (opens_at < closes_at),
  constraint popup_question_resolution check (
    (status = 'open' and correct_answer is null and resolution_episode_id is null
      and reveal_at is null and resolved_at is null and resolved_by is null)
    or (status in ('resolved', 'void') and resolution_episode_id is not null
      and reveal_at is not null
      and resolved_at is not null and resolved_at >= closes_at and resolved_by is not null
      and ((status = 'resolved' and correct_answer is not null)
        or (status = 'void' and correct_answer is null)))
  )
);

create table public.popup_votes (
  question_id uuid not null references public.popup_questions(id),
  user_id uuid not null references public.profiles(id),
  answer text not null check (answer in ('Yes', 'No', 'Skip')),
  voted_at timestamptz not null default clock_timestamp(),
  primary key (question_id, user_id)
);
create index popup_questions_window_idx on public.popup_questions(status, opens_at, closes_at);
create index popup_questions_reveal_idx on public.popup_questions(reveal_at) where status <> 'open';
create index popup_votes_user_idx on public.popup_votes(user_id, question_id);
create index popup_questions_created_by_idx on public.popup_questions(created_by);
create index popup_questions_resolved_by_idx on public.popup_questions(resolved_by);
create index popup_questions_resolution_episode_idx on public.popup_questions(resolution_episode_id);

alter table public.popup_questions enable row level security;
alter table public.popup_votes enable row level security;
revoke all on public.popup_questions, public.popup_votes from public, anon, authenticated, service_role;
grant select, insert, update on public.popup_questions to service_role;
grant select, insert on public.popup_votes to service_role;

-- Resolving on Monday can reveal that Monday; any other day waits until Monday.
-- The linked episode's spoiler gate always remains a lower bound.
create function public.popup_resolution_reveal_at(p_resolved_at timestamptz, p_episode_reveal_at timestamptz)
returns timestamptz language sql stable strict security invoker set search_path = '' as $$
  select greatest(
    (((p_resolved_at at time zone 'America/Detroit')::date
      + ((8 - extract(isodow from p_resolved_at at time zone 'America/Detroit')::integer) % 7)
      + time '06:30') at time zone 'America/Detroit'),
    p_episode_reveal_at
  );
$$;

create function public.protect_popup_question() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  episode_reveal timestamptz;
begin
  if tg_op = 'DELETE' then
    raise exception 'Popup questions cannot be deleted' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'open' then
      raise exception 'New popup questions must be unresolved' using errcode = '23514';
    end if;
    return new;
  end if;
  if row(new.id, new.question, new.details, new.credit_name, new.opens_at, new.closes_at,
      new.points, new.created_at, new.created_by)
    is distinct from row(old.id, old.question, old.details, old.credit_name, old.opens_at,
      old.closes_at, old.points, old.created_at, old.created_by) then
    raise exception 'Popup question wording, credit, rules, and deadlines are immutable' using errcode = '23514';
  end if;
  if new is not distinct from old then return new; end if;
  if old.status <> 'open' or new.status = 'open' then
    raise exception 'A popup question can only be resolved once' using errcode = '23514';
  end if;
  if clock_timestamp() < old.closes_at then
    raise exception 'Close voting before resolving the question' using errcode = '23514';
  end if;
  select reveal_at into episode_reveal from public.episodes
    where id = new.resolution_episode_id and results_posted;
  if not found or new.reveal_at < public.popup_resolution_reveal_at(clock_timestamp(), episode_reveal) then
    raise exception 'A posted episode and its Monday reveal gate are required' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger protect_popup_question before insert or update or delete on public.popup_questions
for each row execute function public.protect_popup_question();

create function public.protect_popup_vote() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'A submitted popup vote cannot be changed or deleted' using errcode = '23514';
end;
$$;
create trigger protect_popup_vote before update or delete on public.popup_votes
for each row execute function public.protect_popup_vote();

create function public.submit_popup_vote(p_question_id uuid, p_user_id uuid, p_answer text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  question_row public.popup_questions%rowtype;
  vote_row public.popup_votes%rowtype;
  checked_at timestamptz;
begin
  if p_answer is null or p_answer not in ('Yes', 'No', 'Skip') then
    return jsonb_build_object('ok', false, 'error', 'Choose Yes, No, or Skip', 'status', 400);
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and league_joined_at is not null) then
    return jsonb_build_object('ok', false, 'error', 'Join the league before answering', 'status', 403);
  end if;
  select * into question_row from public.popup_questions where id = p_question_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That question is unavailable', 'status', 404);
  end if;
  select * into vote_row from public.popup_votes where question_id = p_question_id and user_id = p_user_id;
  if found then
    if vote_row.answer = p_answer then
      return jsonb_build_object('ok', true, 'alreadySubmitted', true, 'vote',
        jsonb_build_object('questionId', vote_row.question_id, 'answer', vote_row.answer, 'votedAt', vote_row.voted_at));
    end if;
    return jsonb_build_object('ok', false, 'error', 'Your first answer is already locked in', 'status', 409,
      'vote', jsonb_build_object('questionId', vote_row.question_id, 'answer', vote_row.answer, 'votedAt', vote_row.voted_at));
  end if;
  -- Transaction-start time can be stale after waiting for a concurrent voter/resolver.
  checked_at := clock_timestamp();
  if question_row.status <> 'open' or checked_at < question_row.opens_at or checked_at >= question_row.closes_at then
    return jsonb_build_object('ok', false, 'error', 'Voting is not open for this question', 'status', 409);
  end if;
  insert into public.popup_votes(question_id, user_id, answer, voted_at)
    values (p_question_id, p_user_id, p_answer, checked_at) returning * into vote_row;
  return jsonb_build_object('ok', true, 'alreadySubmitted', false, 'vote',
    jsonb_build_object('questionId', vote_row.question_id, 'answer', vote_row.answer, 'votedAt', vote_row.voted_at));
end;
$$;

create function public.resolve_popup_question(p_question_id uuid, p_actor_id uuid, p_answer text, p_episode_id integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  question_row public.popup_questions%rowtype;
  episode_reveal timestamptz;
  checked_at timestamptz;
  next_status text;
  next_answer text;
begin
  if p_answer is null or p_answer not in ('Yes', 'No', 'Void') then
    return jsonb_build_object('ok', false, 'error', 'Choose Yes, No, or Void', 'status', 400);
  end if;
  if not exists (select 1 from public.profiles where id = p_actor_id) then
    return jsonb_build_object('ok', false, 'error', 'A verified commissioner account is required', 'status', 403);
  end if;
  next_status := case when p_answer = 'Void' then 'void' else 'resolved' end;
  next_answer := case when p_answer = 'Void' then null else p_answer end;
  select * into question_row from public.popup_questions where id = p_question_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'That question is unavailable', 'status', 404);
  end if;
  if question_row.status <> 'open' then
    if question_row.status = next_status and question_row.correct_answer is not distinct from next_answer
      and question_row.resolution_episode_id = p_episode_id then
      return jsonb_build_object('ok', true, 'alreadyResolved', true, 'questionId', question_row.id,
        'status', question_row.status, 'correctAnswer', question_row.correct_answer,
        'resolutionEpisodeId', question_row.resolution_episode_id, 'revealAt', question_row.reveal_at);
    end if;
    return jsonb_build_object('ok', false, 'error', 'This question has already been resolved', 'status', 409);
  end if;
  checked_at := clock_timestamp();
  if checked_at < question_row.closes_at then
    return jsonb_build_object('ok', false, 'error', 'Close voting before resolving the question', 'status', 409);
  end if;
  select reveal_at into episode_reveal from public.episodes where id = p_episode_id and results_posted;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Record that episode''s results before resolving this question', 'status', 409);
  end if;
  update public.popup_questions set status = next_status, correct_answer = next_answer,
    resolution_episode_id = p_episode_id,
    reveal_at = public.popup_resolution_reveal_at(checked_at, episode_reveal),
    resolved_at = checked_at, resolved_by = p_actor_id
    where id = p_question_id returning * into question_row;
  return jsonb_build_object('ok', true, 'alreadyResolved', false, 'questionId', question_row.id,
    'status', question_row.status, 'correctAnswer', question_row.correct_answer,
    'resolutionEpisodeId', question_row.resolution_episode_id, 'revealAt', question_row.reveal_at);
end;
$$;

revoke all on function public.popup_resolution_reveal_at(timestamptz, timestamptz),
  public.protect_popup_question(), public.protect_popup_vote(),
  public.submit_popup_vote(uuid, uuid, text), public.resolve_popup_question(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.popup_resolution_reveal_at(timestamptz, timestamptz),
  public.protect_popup_question(), public.protect_popup_vote(),
  public.submit_popup_vote(uuid, uuid, text), public.resolve_popup_question(uuid, uuid, text, integer)
  to service_role;
