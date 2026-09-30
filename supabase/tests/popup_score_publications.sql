-- Isolated PostgreSQL only. Every fixture and injected failure rolls back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is not true then raise exception 'Assertion failed: %', message; end if; end;
$$;
insert into auth.users(id,email) values
 ('71000000-0000-4000-8000-000000000001','score-a@example.test'),
 ('71000000-0000-4000-8000-000000000002','score-b@example.test');
update public.profiles set league_joined_at=now()-interval '1 day',total_points=2.5
 where id::text like '71000000-%';
insert into public.episodes(id,title,air_at,lock_at,reveal_at,bonus_question,results_posted,results_published) values
 (9101,'Published fixture',now()-interval '4 days',now()-interval '5 days',now()-interval '2 days','Fixture?',true,true),
 (9102,'Unpublished fixture',now()-interval '4 days',now()-interval '5 days',now()-interval '2 days','Fixture?',true,false),
 (9103,'Future episode fixture',now()-interval '4 days',now()-interval '5 days',now()+interval '2 days','Fixture?',true,true);
insert into public.picks(id,user_id,episode_id,streak_point) values
 (91001,'71000000-0000-4000-8000-000000000001',9101,0);
insert into public.popup_questions(id,question,opens_at,closes_at,created_by)
 select ('72000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'Publication fixture '||i,
 now()-interval '5 days',now()-interval '4 days','71000000-0000-4000-8000-000000000001' from generate_series(1,6) i;
-- Set historical/future fixtures independently of the machine's current weekday.
-- Normal application resolution and immutability have separate real SQL coverage.
alter table public.popup_questions disable trigger protect_popup_question;
update public.popup_questions set status='resolved',correct_answer='Yes',
 resolution_episode_id=case right(id::text,1) when '3' then 9102 when '4' then 9103 else 9101 end,
 reveal_at=case right(id::text,1) when '6' then now()+interval '2 days' else now()-interval '2 days' end,
 resolved_at=case right(id::text,1) when '5' then now()+interval '1 day' else now()-interval '3 days' end,
 resolved_by='71000000-0000-4000-8000-000000000001' where id::text like '72000000-%';
alter table public.popup_questions enable trigger protect_popup_question;

create function pg_temp.score_payload(a numeric,b numeric) returns jsonb language sql as $$
 select jsonb_agg(jsonb_build_object('id',id,'individual_game_pick',individual_game_pick,
 'endgame_pick',endgame_pick,'endgame_pick_switched',endgame_pick_switched,
 'total_points',case right(id::text,1) when '1' then a else b end,'preseason_points',0,
 'individual_game_points',0,'endgame_points',0,'immunity_streak',1,'longest_streak',1) order by id)
 from public.profiles where league_joined_at is not null;
$$;

do $$
declare role_name text;
begin
 foreach role_name in array array['anon','authenticated'] loop
  perform pg_temp.assert_true(not has_table_privilege(role_name,'public.popup_score_publications','SELECT,INSERT,UPDATE,DELETE'),role_name||' cannot access receipts');
  perform pg_temp.assert_true(not has_table_privilege(role_name,'public.pending_popup_score_publications','SELECT'),role_name||' cannot read pending questions');
  perform pg_temp.assert_true(not has_function_privilege(role_name,'public.apply_published_scores(jsonb,jsonb,uuid[],integer[],timestamptz)','EXECUTE'),role_name||' cannot publish scores');
 end loop;
 perform pg_temp.assert_true((select relrowsecurity from pg_class where oid='public.popup_score_publications'::regclass),'receipt RLS enabled');
 perform pg_temp.assert_true((select 'security_invoker=true'=any(reloptions) from pg_class where oid='public.pending_popup_score_publications'::regclass),'pending view is invoker');
 perform pg_temp.assert_true((select not prosecdef from pg_proc where oid='public.apply_published_scores(jsonb,jsonb,uuid[],integer[],timestamptz)'::regprocedure),'publication RPC is invoker');
 perform pg_temp.assert_true(not has_table_privilege('service_role','public.popup_score_publications','UPDATE,DELETE'),'service receipts are append-only');
end;
$$;
set local role service_role;
do $$
declare result boolean; stamps jsonb; hidden_id uuid; old_payload jsonb;
begin
 perform pg_temp.assert_true((select count(*)=2 from public.pending_popup_score_publications where available_at<=now()),'only published and fully revealed popup results are pending');
 result:=public.apply_published_scores(pg_temp.score_payload(3.5,6),'[{"id":91001,"streak_point":1}]','{72000000-0000-4000-8000-000000000001}','{9101}',now());
 perform pg_temp.assert_true(result,'first publication applies');
 perform pg_temp.assert_true((select total_points=3.5 from public.profiles where id='71000000-0000-4000-8000-000000000001'),'fractional total preserved');
 perform pg_temp.assert_true((select streak_point=1 from public.picks where id=91001),'streak score committed');
 perform pg_temp.assert_true((select count(*)=1 from public.popup_score_publications),'only supplied snapshot receipted');
 perform pg_temp.assert_true((select count(*)=1 from public.pending_popup_score_publications where available_at<=now()),'later unreceipted question remains pending');
 select jsonb_agg(updated_at order by id) into stamps from public.profiles;
 perform public.apply_published_scores(pg_temp.score_payload(3.5,6),'[{"id":91001,"streak_point":1}]','{72000000-0000-4000-8000-000000000001}','{9101}',now());
 perform pg_temp.assert_true(stamps=(select jsonb_agg(updated_at order by id) from public.profiles),'identical refresh does not churn timestamps');
 foreach hidden_id in array array['72000000-0000-4000-8000-000000000003'::uuid,'72000000-0000-4000-8000-000000000004'::uuid,'72000000-0000-4000-8000-000000000005'::uuid,'72000000-0000-4000-8000-000000000006'::uuid] loop
  begin
   perform public.apply_published_scores(pg_temp.score_payload(100,100),'[]',array['72000000-0000-4000-8000-000000000001'::uuid,hidden_id],'{9101}',now());
   raise exception 'Expected hidden popup rejection';
  exception when check_violation then null; end;
 end loop;
 old_payload:=pg_temp.score_payload(3.5,6);
 update public.profiles set endgame_pick='fixture-change' where id='71000000-0000-4000-8000-000000000001';
 begin
  perform public.apply_published_scores(old_payload,'[]','{72000000-0000-4000-8000-000000000001}','{9101}',now());
  raise exception 'Expected stale season-pick rejection';
 exception when serialization_failure then null; end;
 update public.profiles set endgame_pick=null where id='71000000-0000-4000-8000-000000000001';
 begin
  perform public.apply_published_scores('[]','[]','{72000000-0000-4000-8000-000000000001}','{9101}',now());
  raise exception 'Expected incomplete member rejection';
 exception when serialization_failure then null; end;
 begin
  perform public.apply_published_scores(old_payload||old_payload,'[]','{72000000-0000-4000-8000-000000000001}','{9101}',now());
  raise exception 'Expected duplicate member rejection';
 exception when serialization_failure then null; end;
end;
$$;
reset role;

-- Inject actual database write failures after the streak write and after all profile writes.
create function pg_temp.fail_score_write() returns trigger language plpgsql as $$
begin raise exception 'Injected score publication write failure' using errcode='23514'; end;
$$;
create trigger score_fixture_failure before update on public.profiles
 for each row when (new.total_points=999) execute function pg_temp.fail_score_write();
set local role service_role;
do $$
begin
 begin
  perform public.apply_published_scores(pg_temp.score_payload(9,999),'[{"id":91001,"streak_point":2}]','{72000000-0000-4000-8000-000000000001,72000000-0000-4000-8000-000000000002}','{9101}',now());
  raise exception 'Expected profile write failure';
 exception when check_violation then null; end;
 perform pg_temp.assert_true((select total_points=3.5 from public.profiles where id='71000000-0000-4000-8000-000000000001'),'profile failure rolls back all profile changes');
 perform pg_temp.assert_true((select streak_point=1 from public.picks where id=91001),'profile failure rolls back prior streak write');
 perform pg_temp.assert_true((select count(*)=1 from public.popup_score_publications),'profile failure leaves receipt pending');
end;
$$;
reset role;
drop trigger score_fixture_failure on public.profiles;
create trigger score_fixture_failure before insert on public.popup_score_publications
 for each row when (new.question_id='72000000-0000-4000-8000-000000000002') execute function pg_temp.fail_score_write();
set local role service_role;
do $$
begin
 begin
  perform public.apply_published_scores(pg_temp.score_payload(9,6),'[{"id":91001,"streak_point":2}]','{72000000-0000-4000-8000-000000000001,72000000-0000-4000-8000-000000000002}','{9101}',now());
  raise exception 'Expected receipt write failure';
 exception when check_violation then null; end;
 perform pg_temp.assert_true((select total_points=3.5 from public.profiles where id='71000000-0000-4000-8000-000000000001'),'receipt failure rolls back profile changes');
 perform pg_temp.assert_true((select streak_point=1 from public.picks where id=91001),'receipt failure rolls back streak changes');
 perform pg_temp.assert_true((select count(*)=1 from public.popup_score_publications),'receipt failure stays pending');
end;
$$;
reset role;
drop trigger score_fixture_failure on public.popup_score_publications;
set local role service_role;
do $$
begin
 perform pg_temp.assert_true(public.apply_published_scores(pg_temp.score_payload(9,6),'[{"id":91001,"streak_point":2}]','{72000000-0000-4000-8000-000000000001,72000000-0000-4000-8000-000000000002}','{9101}',now()),'retry applies');
 perform pg_temp.assert_true(not public.apply_published_scores(pg_temp.score_payload(3.5,6),'[{"id":91001,"streak_point":1}]','{72000000-0000-4000-8000-000000000001}','{9101}',now()),'older overlapping popup snapshot is refused');
 perform pg_temp.assert_true((select total_points=9 from public.profiles where id='71000000-0000-4000-8000-000000000001'),'older snapshot cannot remove newer award');
 perform pg_temp.assert_true((select count(*)=0 from public.pending_popup_score_publications where available_at<=now()),'no published history remains pending');
end;
$$;
-- A request started before a new episode reveal cannot overwrite the newer weekly score.
insert into public.episodes(id,title,air_at,lock_at,reveal_at,bonus_question,results_posted,results_published)
 values(9104,'Just published',now()-interval '3 days',now()-interval '4 days',now()-interval '1 minute','Fixture?',true,true);
do $$
begin
 begin
  perform public.apply_published_scores(pg_temp.score_payload(1,1),'[]','{72000000-0000-4000-8000-000000000001,72000000-0000-4000-8000-000000000002}','{9101}',now()-interval '2 minutes');
  raise exception 'Expected newer published episode snapshot rejection';
 exception when serialization_failure then null; end;
 perform pg_temp.assert_true((select total_points=9 from public.profiles where id='71000000-0000-4000-8000-000000000001'),'new episode rejection preserves totals');
end;
$$;
reset role;
rollback;
