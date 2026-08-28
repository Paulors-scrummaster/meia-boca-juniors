begin;

select plan(44);

select has_function('public', 'consolidate_match', array['uuid','integer','integer','jsonb','uuid'], 'consolidation command exists');
select has_function('public', 'reopen_match_statistics', array['uuid','text','uuid'], 'reopen command exists');
select has_function('public', 'cast_mvp_vote', array['uuid','uuid','uuid'], 'vote command exists');
select has_function('public', 'close_mvp_voting', array['uuid'], 'close command exists');
select has_view('public', 'season_rankings_view', 'rankings view exists');
select has_view('public', 'open_mvp_voting_view', 'open voting view exists');

select throws_ok(
  $$select public.consolidate_match('30000000-0000-4000-8000-000000000101', 1, 0, '[]'::jsonb, gen_random_uuid())$$,
  null, null, 'score and goal contribution count must agree'
);
select throws_ok(
  $$select public.consolidate_match(gen_random_uuid(), 0, 0, '[]'::jsonb, gen_random_uuid())$$,
  null, null, 'consolidation requires an existing match and published lineup'
);
select throws_ok(
  $$select public.reopen_match_statistics(gen_random_uuid(), ' ', gen_random_uuid())$$,
  null, null, 'reopen requires a normalized explanation'
);
select throws_ok(
  $$select public.cast_mvp_vote(gen_random_uuid(), gen_random_uuid(), gen_random_uuid())$$,
  null, null, 'vote requires the current valid open round'
);
select throws_ok(
  $$select public.close_mvp_voting(gen_random_uuid())$$,
  null, null, 'close requires an existing expired round'
);

select is((select count(*)::integer from public.match_consolidations where status = 'INVALIDATED' and id in (select consolidation_id from public.mvp_voting_rounds where status <> 'INVALIDATED')), 0, 'invalidated consolidation cannot retain a valid round');
select is((select count(*)::integer from public.mvp_votes v join public.mvp_voting_rounds r on r.id=v.voting_round_id where v.created_at >= r.closes_at), 0, 'late votes are absent');
select is((select count(*)::integer from public.mvp_votes where voter_athlete_id = voted_athlete_id), 0, 'self votes are absent');
select is((select count(*)::integer from public.mvp_awards where vote_count <= 0), 0, 'zero-vote rounds create no awards');
select is((select count(*)::integer from public.matches m join public.match_consolidations c on c.id=m.current_consolidation_id where c.status <> 'VALID' or c.match_id <> m.id), 0, 'match pointer targets its current valid revision');
select is((select count(*)::integer from public.open_mvp_voting_view where candidate_athlete_id = voter_athlete_id), 0, 'open voting view excludes the caller');
select is((select count(*)::integer from public.season_rankings_view where goals < 0 or assists < 0 or presences < 0 or mvp_awards < 0), 0, 'rankings expose non-negative valid aggregates');

update public.seasons set is_active=false;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000016001','rpc-stat-president@example.test'),
 ('00000000-0000-4000-8000-000000016002','rpc-stat-a1@example.test'),
 ('00000000-0000-4000-8000-000000016003','rpc-stat-a2@example.test'),
 ('00000000-0000-4000-8000-000000016004','rpc-stat-a3@example.test'),
 ('00000000-0000-4000-8000-000000016005','rpc-stat-a4@example.test');
insert into public.profiles(id) select id from auth.users where id::text like '00000000-0000-4000-8000-00000001600%';
insert into public.user_roles(user_id,role,assigned_by) values
 ('00000000-0000-4000-8000-000000016001','PRESIDENT','00000000-0000-4000-8000-000000016001'),
 ('00000000-0000-4000-8000-000000016002','ATHLETE','00000000-0000-4000-8000-000000016001'),
 ('00000000-0000-4000-8000-000000016003','ATHLETE','00000000-0000-4000-8000-000000016001'),
 ('00000000-0000-4000-8000-000000016004','ATHLETE','00000000-0000-4000-8000-000000016001'),
 ('00000000-0000-4000-8000-000000016005','ATHLETE','00000000-0000-4000-8000-000000016001');
insert into public.athletes(id,user_id,full_name,shirt_name,shirt_number,primary_position) values
 ('00000000-0000-4000-8000-000000016101','00000000-0000-4000-8000-000000016002','Atleta RPC Um','Um',81,'Ataque'),
 ('00000000-0000-4000-8000-000000016102','00000000-0000-4000-8000-000000016003','Atleta RPC Dois','Dois',82,'Meio'),
 ('00000000-0000-4000-8000-000000016103','00000000-0000-4000-8000-000000016004','Atleta RPC Três','Três',83,'Defesa'),
 ('00000000-0000-4000-8000-000000016104','00000000-0000-4000-8000-000000016005','Atleta RPC Quatro','Quatro',84,'Gol');
insert into public.seasons(id,year,is_active) values('00000000-0000-4000-8000-000000016201',2040,true);
insert into public.matches(id,season_id,opponent_name,match_date,confirmation_deadline,created_by,updated_by) values
 ('00000000-0000-4000-8000-000000016301','00000000-0000-4000-8000-000000016201','Sem Escalação FC',statement_timestamp()-interval '2 hours',statement_timestamp()-interval '1 day','00000000-0000-4000-8000-000000016001','00000000-0000-4000-8000-000000016001'),
 ('00000000-0000-4000-8000-000000016302','00000000-0000-4000-8000-000000016201','Estatística FC',statement_timestamp()-interval '2 hours',statement_timestamp()-interval '1 day','00000000-0000-4000-8000-000000016001','00000000-0000-4000-8000-000000016001');
insert into public.lineups(id,match_id,revision,formation_code,created_by)
values('00000000-0000-4000-8000-000000016401','00000000-0000-4000-8000-000000016302',1,'4-4-2','00000000-0000-4000-8000-000000016001');
insert into public.lineup_players(lineup_id,athlete_id,assignment,tactical_position,position_x,position_y,display_order) values
 ('00000000-0000-4000-8000-000000016401','00000000-0000-4000-8000-000000016101','STARTER','ATA',50,20,0),
 ('00000000-0000-4000-8000-000000016401','00000000-0000-4000-8000-000000016102','STARTER','MEI',50,50,1),
 ('00000000-0000-4000-8000-000000016401','00000000-0000-4000-8000-000000016103','STARTER','DEF',50,75,2),
 ('00000000-0000-4000-8000-000000016401','00000000-0000-4000-8000-000000016104','STARTER','GOL',50,95,3);
update public.lineups set status='PUBLISHED',published_by='00000000-0000-4000-8000-000000016001',published_at=statement_timestamp()
where id='00000000-0000-4000-8000-000000016401';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000016001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000016001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.consolidate_match('00000000-0000-4000-8000-000000016301',0,0,'[]',gen_random_uuid())$$,'P0001','PUBLISHED_LINEUP_REQUIRED','published lineup is required');
select throws_ok($$select public.consolidate_match('00000000-0000-4000-8000-000000016302',1,0,'[]',gen_random_uuid())$$,'22023','VALIDATION_ERROR','score must match goal contributions');
select lives_ok($$select public.consolidate_match('00000000-0000-4000-8000-000000016302',2,1,'[{"sequence":1,"scorerAthleteId":"00000000-0000-4000-8000-000000016101","assistantAthleteId":"00000000-0000-4000-8000-000000016102","isOpponentOwnGoal":false},{"sequence":2,"scorerAthleteId":null,"assistantAthleteId":null,"isOpponentOwnGoal":true}]','00000000-0000-4000-8000-000000016501')$$,'valid result consolidates');
select lives_ok($$select public.consolidate_match('00000000-0000-4000-8000-000000016302',2,1,'[{"sequence":1,"scorerAthleteId":"00000000-0000-4000-8000-000000016101","assistantAthleteId":"00000000-0000-4000-8000-000000016102","isOpponentOwnGoal":false},{"sequence":2,"scorerAthleteId":null,"assistantAthleteId":null,"isOpponentOwnGoal":true}]','00000000-0000-4000-8000-000000016501')$$,'consolidation retry is idempotent');
reset role;
select is((select count(*)::integer from public.match_consolidations where match_id='00000000-0000-4000-8000-000000016302'),1,'retry creates one consolidation');
select is((select lineup_id from public.match_consolidations where match_id='00000000-0000-4000-8000-000000016302'),'00000000-0000-4000-8000-000000016401'::uuid,'exact lineup revision is captured');
select is((select closes_at-opens_at from public.mvp_voting_rounds r join public.match_consolidations c on c.id=r.consolidation_id where c.match_id='00000000-0000-4000-8000-000000016302'),interval '24 hours','voting window is exactly 24 hours');
select is((select count(*)::integer from public.notification_events where kind='VOTING_OPENED' and resource_id in(select r.id from public.mvp_voting_rounds r join public.match_consolidations c on c.id=r.consolidation_id where c.match_id='00000000-0000-4000-8000-000000016302')),1,'retry creates one voting event');
select throws_ok($$update public.match_consolidations set lineup_id=gen_random_uuid() where match_id='00000000-0000-4000-8000-000000016302'$$,'55000','consolidation history is immutable','captured lineup cannot change');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000016002',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000016002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.cast_mvp_vote((select id from public.mvp_voting_rounds limit 1),'00000000-0000-4000-8000-000000016101',gen_random_uuid())$$,'22023','SELF_VOTE_FORBIDDEN','self vote is denied');
select lives_ok($$select public.cast_mvp_vote((select r.id from public.mvp_voting_rounds r join public.match_consolidations c on c.id=r.consolidation_id where c.match_id='00000000-0000-4000-8000-000000016302'),'00000000-0000-4000-8000-000000016102','00000000-0000-4000-8000-000000016502')$$,'eligible Athlete votes');
select lives_ok($$select public.cast_mvp_vote((select r.id from public.mvp_voting_rounds r join public.match_consolidations c on c.id=r.consolidation_id where c.match_id='00000000-0000-4000-8000-000000016302'),'00000000-0000-4000-8000-000000016102','00000000-0000-4000-8000-000000016502')$$,'vote retry is idempotent');
select throws_ok($$select public.cast_mvp_vote((select r.id from public.mvp_voting_rounds r join public.match_consolidations c on c.id=r.consolidation_id where c.match_id='00000000-0000-4000-8000-000000016302'),'00000000-0000-4000-8000-000000016103',gen_random_uuid())$$,'23505','VOTE_ALREADY_CAST','one vote per valid round survives concurrent retries');
reset role;
select is((select count(*)::integer from public.mvp_votes),1,'vote retry creates one row');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000016003',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000016003","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.cast_mvp_vote((select r.id from public.mvp_voting_rounds r join public.match_consolidations c on c.id=r.consolidation_id where c.match_id='00000000-0000-4000-8000-000000016302'),'00000000-0000-4000-8000-000000016101',gen_random_uuid())$$,'second Athlete creates a top tie');
reset role;
update public.mvp_voting_rounds set opens_at=statement_timestamp()-interval '25 hours',closes_at=statement_timestamp()-interval '1 hour'
where consolidation_id=(select id from public.match_consolidations where match_id='00000000-0000-4000-8000-000000016302' and status='VALID');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000016001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000016001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.close_mvp_voting((select r.id from public.mvp_voting_rounds r join public.match_consolidations c on c.id=r.consolidation_id where c.match_id='00000000-0000-4000-8000-000000016302'))$$,'expired tied round closes');
reset role;
select is((select count(*)::integer from public.mvp_awards where invalidated_at is null),2,'all positive top ties receive awards');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000016001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000016001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.reopen_match_statistics('00000000-0000-4000-8000-000000016302','Correção oficial','00000000-0000-4000-8000-000000016503')$$,'President reopens without deleting history');
reset role;
select is((select status::text from public.match_consolidations where match_id='00000000-0000-4000-8000-000000016302'),'INVALIDATED','old consolidation is invalidated');
select is((select count(*)::integer from public.mvp_votes),2,'invalidated-round vote history is preserved');
select is((select count(*)::integer from public.mvp_awards where invalidated_at is not null),2,'reopen invalidates tied awards without deleting them');

update public.lineups set status='SUPERSEDED' where id='00000000-0000-4000-8000-000000016401';
insert into public.lineups(id,match_id,revision,formation_code,created_by)
values('00000000-0000-4000-8000-000000016402','00000000-0000-4000-8000-000000016302',2,'4-3-3','00000000-0000-4000-8000-000000016001');
insert into public.lineup_players(lineup_id,athlete_id,assignment,tactical_position,position_x,position_y,display_order) values
 ('00000000-0000-4000-8000-000000016402','00000000-0000-4000-8000-000000016101','STARTER','ATA',50,20,0),
 ('00000000-0000-4000-8000-000000016402','00000000-0000-4000-8000-000000016102','STARTER','MEI',50,50,1),
 ('00000000-0000-4000-8000-000000016402','00000000-0000-4000-8000-000000016103','STARTER','DEF',50,75,2);
update public.lineups set status='PUBLISHED',published_by='00000000-0000-4000-8000-000000016001',published_at=statement_timestamp()
where id='00000000-0000-4000-8000-000000016402';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000016001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000016001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.consolidate_match('00000000-0000-4000-8000-000000016302',0,0,'[]','00000000-0000-4000-8000-000000016504')$$,'reconsolidation creates a fresh revision');
reset role;
select is((select count(*)::integer from public.match_consolidations where match_id='00000000-0000-4000-8000-000000016302'),2,'reconsolidation preserves both revisions');
select is((select count(*)::integer from public.mvp_voting_rounds where status='OPEN'),1,'reconsolidation opens one fresh voting round');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000016002',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000016002","role":"authenticated","aal":"aal1"}',true);
select lives_ok($$select public.cast_mvp_vote((select id from public.mvp_voting_rounds where status='OPEN'),'00000000-0000-4000-8000-000000016102',gen_random_uuid())$$,'invalidated-round voter may vote in the fresh round');
reset role;
select is((select count(*)::integer from public.mvp_votes where voter_athlete_id='00000000-0000-4000-8000-000000016101'),2,'one historical and one fresh vote coexist');

select * from finish();
rollback;
