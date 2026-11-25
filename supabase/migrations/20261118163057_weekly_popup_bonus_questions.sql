-- Preserve historical three-point questions while making every new question five points.
alter table public.popup_questions alter column points set default 5;
alter table public.popup_questions drop constraint if exists popup_questions_points_check;
alter table public.popup_questions add constraint popup_questions_points_check check (points in (3, 5));

-- Episode 10 begins the automatic weekly popup series. One immutable question belongs
-- to one episode and closes exactly when weekly picks close.
alter table public.popup_questions add column target_episode_id integer references public.episodes(id);
alter table public.popup_questions add constraint popup_question_weekly_target
  check (target_episode_id is null or (target_episode_id >= 10 and points = 5));
create unique index popup_questions_target_episode_unique on public.popup_questions(target_episode_id)
  where target_episode_id is not null;

create function public.protect_weekly_popup_question() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  target_lock timestamptz;
begin
  if tg_op = 'UPDATE' and new.target_episode_id is distinct from old.target_episode_id then
    raise exception 'A weekly popup question cannot be retargeted' using errcode = '23514';
  end if;
  if new.target_episode_id is not null then
    select lock_at into target_lock from public.episodes where id = new.target_episode_id;
    if not found or new.points <> 5 or new.closes_at is distinct from target_lock then
      raise exception 'A weekly popup question must be worth five points and close at its episode lock' using errcode = '23514';
    end if;
    if new.resolution_episode_id is not null and new.resolution_episode_id <> new.target_episode_id then
      raise exception 'A weekly popup question can only be resolved by its target episode' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_weekly_popup_question before insert or update on public.popup_questions
for each row execute function public.protect_weekly_popup_question();

revoke all on function public.protect_weekly_popup_question() from public, anon, authenticated, service_role;
grant execute on function public.protect_weekly_popup_question() to service_role;
