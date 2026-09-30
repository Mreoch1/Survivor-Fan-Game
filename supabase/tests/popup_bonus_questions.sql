-- Run only against an isolated database containing the repository migrations.
-- All fixture rows and assertions roll back. Concurrency tests use separate sessions.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'popup-admin@example.test', '{}'),
  ('10000000-0000-4000-8000-000000000002', 'popup-player@example.test', '{}'),
  ('10000000-0000-4000-8000-000000000003', 'popup-outsider@example.test', '{}');
update public.profiles set league_joined_at = now() - interval '1 day'
  where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002');
insert into public.episodes(id, title, air_at, lock_at, reveal_at, bonus_question, results_posted) values
  (9001, 'Popup posted fixture', now() - interval '2 days', now() - interval '3 days', now() - interval '1 day', 'Fixture?', true),
  (9002, 'Popup unposted fixture', now() - interval '2 days', now() - interval '3 days', now() - interval '1 day', 'Fixture?', false),
  (9003, 'Popup future reveal fixture', now() - interval '2 days', now() - interval '3 days', '2999-01-01 13:00:00+00', 'Fixture?', true);

create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin
  if value is not true then raise exception 'Assertion failed: %', message; end if;
end;
$$;

-- Check every exposed object, not just the application route's authorization.
do $$
declare role_name text; table_name text; function_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    foreach table_name in array array['public.popup_questions', 'public.popup_votes'] loop
      perform pg_temp.assert_true(not has_table_privilege(role_name, table_name, 'SELECT,INSERT,UPDATE,DELETE'), role_name || ' has no direct ' || table_name || ' access');
    end loop;
    foreach function_name in array array[
      'public.submit_popup_vote(uuid,uuid,text)', 'public.resolve_popup_question(uuid,uuid,text,integer)',
      'public.popup_resolution_reveal_at(timestamp with time zone,timestamp with time zone)',
      'public.protect_popup_question()', 'public.protect_popup_vote()'] loop
      perform pg_temp.assert_true(not has_function_privilege(role_name, function_name, 'EXECUTE'), role_name || ' cannot invoke ' || function_name);
    end loop;
  end loop;
  perform pg_temp.assert_true(not has_table_privilege('service_role', 'public.popup_votes', 'UPDATE,DELETE'), 'service role cannot alter submitted votes');
  perform pg_temp.assert_true(not has_table_privilege('service_role', 'public.popup_questions', 'DELETE'), 'service role cannot delete questions');
  perform pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in ('public.popup_questions'::regclass, 'public.popup_votes'::regclass)), 'RLS is enabled');
  perform pg_temp.assert_true((select not bool_or(prosecdef) from pg_proc where oid in ('public.submit_popup_vote(uuid,uuid,text)'::regprocedure, 'public.resolve_popup_question(uuid,uuid,text,integer)'::regprocedure)), 'RPCs run as invoker');
end;
$$;

set local role service_role;
insert into public.popup_questions(id, question, details, credit_name, opens_at, closes_at, created_by) values
  ('20000000-0000-4000-8000-000000000001', 'Will the fixture happen?', 'An exact qualifying event.', 'Fixture author', now() - interval '1 hour', now() + interval '1 hour', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Not open?', '', '', now() + interval '1 hour', now() + interval '2 hours', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000003', 'Closed?', '', '', now() - interval '2 hours', now() - interval '1 hour', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000004', 'Voided?', '', '', now() - interval '2 hours', now() - interval '1 hour', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000005', 'Episode gate?', '', '', now() - interval '2 hours', now() - interval '1 hour', '10000000-0000-4000-8000-000000000001');

do $$
declare answer jsonb; original_vote jsonb;
begin
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Yes');
  perform pg_temp.assert_true(answer->>'status' = '403', 'unjoined player rejected');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', null);
  perform pg_temp.assert_true(answer->>'status' = '400', 'missing vote rejected');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Maybe');
  perform pg_temp.assert_true(answer->>'status' = '400', 'unknown vote rejected');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000002', 'Yes');
  perform pg_temp.assert_true(answer->>'status' = '404', 'missing question rejected');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Yes');
  perform pg_temp.assert_true(answer->>'status' = '409', 'before opening rejected');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Yes');
  perform pg_temp.assert_true(answer->>'status' = '409', 'after closing rejected');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Yes');
  perform pg_temp.assert_true(answer->>'ok' = 'true' and answer->>'alreadySubmitted' = 'false', 'first answer accepted');
  original_vote := answer->'vote';
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Yes');
  perform pg_temp.assert_true(answer->>'alreadySubmitted' = 'true' and answer->'vote' = original_vote, 'same answer retry preserves original timestamp');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'No');
  perform pg_temp.assert_true(answer->>'status' = '409' and answer->'vote' = original_vote, 'opposite answer preserves original vote');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Skip');
  perform pg_temp.assert_true(answer->>'ok' = 'true' and answer->'vote'->>'answer' = 'Skip', 'explicit skip is a locked choice');
  answer := public.submit_popup_vote('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Yes');
  perform pg_temp.assert_true(answer->>'status' = '409', 'skip cannot later become a vote');
end;
$$;

-- The service-role RPC is the sole normal write path. Triggers also stop direct mutations.
do $$
begin
  begin
    update public.popup_questions set question = 'Changed question' where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'Expected immutable question rejection';
  exception when check_violation then null; end;
  begin
    update public.popup_questions set closes_at = closes_at + interval '1 day' where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'Expected immutable deadline rejection';
  exception when check_violation then null; end;
  begin
    update public.popup_votes set answer = 'No' where question_id = '20000000-0000-4000-8000-000000000001';
    raise exception 'Expected vote update permission rejection';
  exception when insufficient_privilege then null; end;
end;
$$;

do $$
declare answer jsonb; original_resolution jsonb; original_totals jsonb;
begin
  select jsonb_agg(jsonb_build_array(id, total_points) order by id) into original_totals from public.profiles;
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Yes', 9001);
  perform pg_temp.assert_true(answer->>'status' = '409', 'cannot resolve while voting remains open');
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Yes', 9002);
  perform pg_temp.assert_true(answer->>'status' = '409', 'unposted episode rejected');
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000003', null, 'Yes', 9001);
  perform pg_temp.assert_true(answer->>'status' = '403', 'unknown actor rejected');
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', null, 9001);
  perform pg_temp.assert_true(answer->>'status' = '400', 'missing resolution rejected');
  begin
    perform public.resolve_popup_question('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Yes', 9001);
    raise exception 'Simulated transaction failure';
  exception when raise_exception then null; end;
  perform pg_temp.assert_true((select status = 'open' and correct_answer is null from public.popup_questions where id = '20000000-0000-4000-8000-000000000003'), 'failed transaction rolls the complete resolution back');
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Yes', 9001);
  perform pg_temp.assert_true(answer->>'ok' = 'true' and answer->>'status' = 'resolved' and answer->>'correctAnswer' = 'Yes', 'closed question resolves');
  original_resolution := answer - 'alreadyResolved';
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Yes', 9001);
  perform pg_temp.assert_true(answer->>'alreadyResolved' = 'true' and answer - 'alreadyResolved' = original_resolution, 'same resolution is idempotent');
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'No', 9001);
  perform pg_temp.assert_true(answer->>'status' = '409', 'opposite resolution rejected');
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Yes', 9003);
  perform pg_temp.assert_true(answer->>'status' = '409', 'changing resolution episode rejected');
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Void', 9001);
  perform pg_temp.assert_true(answer->>'ok' = 'true' and answer->>'status' = 'void' and answer->>'correctAnswer' is null, 'void has no correct answer');
  answer := public.resolve_popup_question('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'No', 9003);
  perform pg_temp.assert_true((answer->>'revealAt')::timestamptz = '2999-01-01 13:00:00+00', 'episode reveal is never weakened');
  perform pg_temp.assert_true((select jsonb_agg(jsonb_build_array(id, total_points) order by id) from public.profiles) = original_totals, 'RPC does not increment cached totals');
end;
$$;

-- Date-only fixtures cover the local Monday boundary and both daylight-saving transitions.
select pg_temp.assert_true(public.popup_resolution_reveal_at('2026-09-30 17:00+00', '2026-09-28 10:30+00') = '2026-10-05 10:30+00', 'Wednesday waits until Monday');
select pg_temp.assert_true(public.popup_resolution_reveal_at('2026-10-05 14:00+00', '2026-09-28 10:30+00') = '2026-10-05 10:30+00', 'Monday may reveal that Monday');
select pg_temp.assert_true(public.popup_resolution_reveal_at('2026-10-05 03:59+00', '2026-09-28 10:30+00') = '2026-10-05 10:30+00', 'UTC Monday is still local Sunday');
select pg_temp.assert_true(public.popup_resolution_reveal_at('2026-03-06 17:00+00', '2026-03-02 11:30+00') = '2026-03-09 10:30+00', 'spring daylight saving changes UTC hour');
select pg_temp.assert_true(public.popup_resolution_reveal_at('2026-10-30 17:00+00', '2026-10-26 10:30+00') = '2026-11-02 11:30+00', 'fall daylight saving changes UTC hour');
select pg_temp.assert_true(public.popup_resolution_reveal_at('2026-12-31 17:00+00', '2026-12-28 11:30+00') = '2027-01-04 11:30+00', 'Monday crosses year boundary');


-- Clock-independent Monday-afternoon case: copy the actual table CHECK constraints.
-- The RPC's wall-clock and locking behavior are covered by the live tests above.
create temp table monday_popup_resolution (like public.popup_questions including defaults including constraints);
insert into monday_popup_resolution(id, question, details, opens_at, closes_at, created_by,
  status, correct_answer, resolution_episode_id, reveal_at, resolved_at, resolved_by)
values ('20000000-0000-4000-8000-000000000006', 'Monday afternoon close?', 'Precise fixture scope.',
  '2026-10-05 12:00+00', '2026-10-05 16:00+00', '10000000-0000-4000-8000-000000000001',
  'resolved', 'Yes', 9001,
  public.popup_resolution_reveal_at('2026-10-05 17:00+00', '2026-09-28 10:30+00'),
  '2026-10-05 17:00+00', '10000000-0000-4000-8000-000000000001');
select pg_temp.assert_true((select reveal_at = '2026-10-05 10:30+00'::timestamptz
  and reveal_at < closes_at and resolved_at > closes_at from monday_popup_resolution),
  'Monday afternoon resolution accepts that Monday gate while preserving the actual result time');

reset role;
-- Even the table owner cannot silently rewrite or delete the immutable records.
do $$
begin
  begin
    update public.popup_votes set answer = 'No' where question_id = '20000000-0000-4000-8000-000000000001';
    raise exception 'Expected owner vote trigger rejection';
  exception when check_violation then null; end;
  begin
    delete from public.popup_votes where question_id = '20000000-0000-4000-8000-000000000001';
    raise exception 'Expected owner vote deletion rejection';
  exception when check_violation then null; end;
  begin
    update public.popup_questions set correct_answer = 'No' where id = '20000000-0000-4000-8000-000000000003';
    raise exception 'Expected resolved answer trigger rejection';
  exception when check_violation then null; end;
end;
$$;

rollback;
\echo Popup question SQL assertions passed; all test rows rolled back.
