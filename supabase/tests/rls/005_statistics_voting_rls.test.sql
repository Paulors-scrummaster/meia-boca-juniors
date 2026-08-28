begin;

select plan(16);

select policies_are('public', 'match_consolidations', array['match_consolidations_select_active_accounts'], 'consolidations expose read-only RLS');
select policies_are('public', 'match_goals', array['match_goals_select_active_accounts'], 'goals expose read-only RLS');
select policies_are('public', 'mvp_voting_rounds', array['mvp_voting_rounds_select_active_accounts'], 'rounds expose read-only RLS');
select policies_are('public', 'mvp_votes', array['mvp_votes_select_own'], 'vote details are private to the voter');
select policies_are('public', 'mvp_awards', array['mvp_awards_select_active_accounts'], 'awards are readable by active accounts');

select function_privs_are('public', 'consolidate_match', array['uuid','integer','integer','jsonb','uuid'], 'authenticated', array['EXECUTE'], 'authenticated may invoke consolidation contract');
select function_privs_are('public', 'reopen_match_statistics', array['uuid','text','uuid'], 'authenticated', array['EXECUTE'], 'authenticated may invoke reopen contract');
select function_privs_are('public', 'cast_mvp_vote', array['uuid','uuid','uuid'], 'authenticated', array['EXECUTE'], 'authenticated may invoke vote contract');
select function_privs_are('public', 'close_mvp_voting', array['uuid'], 'authenticated', array['EXECUTE'], 'authenticated may invoke recovery close contract');

insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000015001','statistics-president@example.test'),
  ('00000000-0000-4000-8000-000000015002','statistics-athlete@example.test');
insert into public.profiles(id) values
  ('00000000-0000-4000-8000-000000015001'),
  ('00000000-0000-4000-8000-000000015002');
insert into public.user_roles(user_id,role,assigned_by) values
  ('00000000-0000-4000-8000-000000015001','PRESIDENT','00000000-0000-4000-8000-000000015001'),
  ('00000000-0000-4000-8000-000000015002','ATHLETE','00000000-0000-4000-8000-000000015001');
insert into public.athletes(id,user_id,full_name,shirt_name,shirt_number,primary_position)
values('00000000-0000-4000-8000-000000015101','00000000-0000-4000-8000-000000015002','Atleta Estatística','Estatística',95,'Atacante');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000015002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000015002","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$select public.consolidate_match(gen_random_uuid(), 0, 0, '[]'::jsonb, gen_random_uuid())$$, '42501', 'FORBIDDEN', 'Athlete cannot consolidate');
select throws_ok($$select public.reopen_match_statistics(gen_random_uuid(), 'Correção', gen_random_uuid())$$, '42501', 'FORBIDDEN', 'Athlete cannot reopen statistics');
select is((select count(*)::integer from public.mvp_votes), 0, 'Athlete cannot inspect other vote details');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000015001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000015001","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$select public.consolidate_match(gen_random_uuid(), 0, 0, '[]'::jsonb, gen_random_uuid())$$, '42501', 'MFA_REQUIRED', 'President consolidation requires AAL2');
select throws_ok($$select public.reopen_match_statistics(gen_random_uuid(), 'Correção', gen_random_uuid())$$, '42501', 'MFA_REQUIRED', 'President reopen requires AAL2');
reset role;

select table_privs_are('public', 'mvp_votes', 'authenticated', array['SELECT'], 'direct vote inserts are denied');
select table_privs_are('public', 'match_consolidations', 'authenticated', array['SELECT'], 'direct consolidation writes are denied');

select * from finish();
rollback;
