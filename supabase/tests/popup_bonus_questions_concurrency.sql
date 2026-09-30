-- ISOLATED DATABASE ONLY: this test commits its fixture so independent sessions
-- can see it. Drop the disposable database afterward; never run in production.
-- Requires local PostgreSQL's dblink extension and a trusted local Unix socket.
\set ON_ERROR_STOP on
create extension if not exists dblink;
insert into auth.users(id, email, raw_user_meta_data) values
  ('30000000-0000-4000-8000-000000000001', 'concurrent-admin@example.test', '{}'),
  ('30000000-0000-4000-8000-000000000002', 'concurrent-player@example.test', '{}');
update public.profiles set league_joined_at = now() - interval '1 day'
  where id in ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002');
insert into public.episodes(id, title, air_at, lock_at, reveal_at, bonus_question, results_posted)
  values (9101, 'Concurrent popup fixture', now() - interval '2 days', now() - interval '3 days', now() - interval '1 day', 'Fixture?', true);
insert into public.popup_questions(id, question, opens_at, closes_at, created_by) values
  ('40000000-0000-4000-8000-000000000001', 'Concurrent votes?', now() - interval '1 hour', now() + interval '1 hour', '30000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', 'Concurrent resolutions?', now() - interval '2 hours', now() - interval '1 hour', '30000000-0000-4000-8000-000000000001');

create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin
  if value is not true then raise exception 'Assertion failed: %', message; end if;
end;
$$;
create function pg_temp.wait_for_locks(expected integer) returns void language plpgsql as $$
declare attempt integer;
begin
  for attempt in 1..500 loop
    perform pg_stat_clear_snapshot();
    if (select count(*) from pg_stat_activity where application_name in ('popup_test_one', 'popup_test_two') and wait_event_type = 'Lock') >= expected then return; end if;
    perform pg_sleep(0.01);
  end loop;
  raise exception 'Concurrent sessions did not reach the expected row lock';
end;
$$;
do $$
declare connection text;
begin
  connection := format('host=%L port=%L dbname=%L user=%L', split_part(current_setting('unix_socket_directories'), ',', 1), current_setting('port'), current_database(), current_user);
  perform public.dblink_connect('popup_locker', connection);
  perform public.dblink_connect('popup_one', connection || ' application_name=popup_test_one options=''-c role=service_role''');
  perform public.dblink_connect('popup_two', connection || ' application_name=popup_test_two options=''-c role=service_role''');
end;
$$;

-- Force both conflicting submissions to wait on the same row before either wins.
select public.dblink_exec('popup_locker', 'begin');
select * from public.dblink('popup_locker', $$select id from public.popup_questions where id = '40000000-0000-4000-8000-000000000001' for update$$) as locked(id uuid);
select public.dblink_send_query('popup_one', $$select public.submit_popup_vote('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','Yes')$$);
select public.dblink_send_query('popup_two', $$select public.submit_popup_vote('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','No')$$);
select pg_temp.wait_for_locks(2);
select public.dblink_exec('popup_locker', 'commit');
create temp table concurrent_answers(answer jsonb);
insert into concurrent_answers select answer from public.dblink_get_result('popup_one') as result(answer jsonb);
insert into concurrent_answers select answer from public.dblink_get_result('popup_two') as result(answer jsonb);
select pg_temp.assert_true((select count(*) = 1 from concurrent_answers where answer->>'ok' = 'true'), 'exactly one concurrent vote succeeds');
select pg_temp.assert_true((select count(*) = 1 from concurrent_answers where answer->>'status' = '409'), 'other concurrent vote receives conflict');
select pg_temp.assert_true((select count(*) = 1 from public.popup_votes where question_id = '40000000-0000-4000-8000-000000000001'), 'one stored vote after contention');
-- Consume the end-of-results message before the next asynchronous query.
select * from public.dblink_get_result('popup_one') as result(answer jsonb);
select * from public.dblink_get_result('popup_two') as result(answer jsonb);

-- A request starts before closing but cannot gain the lock until after closing.
insert into public.popup_questions(id, question, opens_at, closes_at, created_by)
  values ('40000000-0000-4000-8000-000000000003', 'Deadline while blocked?', clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 second', '30000000-0000-4000-8000-000000000001');
select public.dblink_exec('popup_locker', 'begin');
select * from public.dblink('popup_locker', $$select id from public.popup_questions where id = '40000000-0000-4000-8000-000000000003' for update$$) as locked(id uuid);
select public.dblink_send_query('popup_one', $$select public.submit_popup_vote('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','Yes')$$);
select pg_temp.wait_for_locks(1);
select pg_sleep(greatest(0, extract(epoch from closes_at - clock_timestamp())) + 0.05) from public.popup_questions where id = '40000000-0000-4000-8000-000000000003';
select public.dblink_exec('popup_locker', 'commit');
select pg_temp.assert_true(answer->>'status' = '409', 'time is checked after waiting, not at transaction start') from public.dblink_get_result('popup_one') as result(answer jsonb);
select pg_temp.assert_true(not exists(select 1 from public.popup_votes where question_id = '40000000-0000-4000-8000-000000000003'), 'no late vote was inserted');
select * from public.dblink_get_result('popup_one') as result(answer jsonb);

-- Resolution races also serialize: an opposite result cannot overwrite the winner.
select public.dblink_exec('popup_locker', 'begin');
select * from public.dblink('popup_locker', $$select id from public.popup_questions where id = '40000000-0000-4000-8000-000000000002' for update$$) as locked(id uuid);
select public.dblink_send_query('popup_one', $$select public.resolve_popup_question('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','Yes',9101)$$);
select public.dblink_send_query('popup_two', $$select public.resolve_popup_question('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','Void',9101)$$);
select pg_temp.wait_for_locks(2);
select public.dblink_exec('popup_locker', 'commit');
truncate concurrent_answers;
insert into concurrent_answers select answer from public.dblink_get_result('popup_one') as result(answer jsonb);
insert into concurrent_answers select answer from public.dblink_get_result('popup_two') as result(answer jsonb);
select pg_temp.assert_true((select count(*) = 1 from concurrent_answers where answer->>'ok' = 'true'), 'exactly one concurrent resolution succeeds');
select pg_temp.assert_true((select count(*) = 1 from concurrent_answers where answer->>'status' = '409'), 'conflicting resolution receives conflict');
select * from public.dblink_get_result('popup_one') as result(answer jsonb);
select * from public.dblink_get_result('popup_two') as result(answer jsonb);

-- A lost response can be retried after the deadline without changing the vote.
insert into public.popup_questions(id, question, opens_at, closes_at, created_by)
  values ('40000000-0000-4000-8000-000000000004', 'Retry after closing?', clock_timestamp() - interval '1 hour', clock_timestamp() + interval '1 second', '30000000-0000-4000-8000-000000000001');
create temp table original_retry_vote as select public.submit_popup_vote('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002','No')->'vote' as vote;
select pg_sleep(greatest(0, extract(epoch from closes_at - clock_timestamp())) + 0.05) from public.popup_questions where id = '40000000-0000-4000-8000-000000000004';
select pg_temp.assert_true(answer->>'alreadySubmitted' = 'true' and answer->'vote' = (select vote from original_retry_vote), 'same answer after close returns the original timestamp')
  from (select public.submit_popup_vote('40000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002','No') as answer) retry;
select public.dblink_disconnect('popup_one');
select public.dblink_disconnect('popup_two');
select public.dblink_disconnect('popup_locker');
\echo Popup concurrency assertions passed; discard this isolated database.
