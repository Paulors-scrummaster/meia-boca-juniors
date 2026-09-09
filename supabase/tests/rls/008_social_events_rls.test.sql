begin;

select plan(8);

-- Dois atletas com login + um presidente.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000051901', 'social-rls-president@example.test'),
  ('00000000-0000-4000-8000-000000051902', 'social-rls-a1@example.test'),
  ('00000000-0000-4000-8000-000000051903', 'social-rls-a2@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000519%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-000000051901', 'PRESIDENT', '00000000-0000-4000-8000-000000051901'),
  ('00000000-0000-4000-8000-000000051902', 'ATHLETE', '00000000-0000-4000-8000-000000051901'),
  ('00000000-0000-4000-8000-000000051903', 'ATHLETE', '00000000-0000-4000-8000-000000051901');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-000000051801', '00000000-0000-4000-8000-000000051902', 'RLS A1', 'A1', 51, 'Meio'),
  ('00000000-0000-4000-8000-000000051802', '00000000-0000-4000-8000-000000051903', 'RLS A2', 'A2', 52, 'Ataque');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000051901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000051901","role":"authenticated","aal":"aal2"}', true);
select public.create_social_event('RLS Churrasco', now() + interval '1 day', 'Sede', 90.00, gen_random_uuid());
reset role;

insert into public.social_event_presences (social_event_id, athlete_id, status, guests_count) values
  ((select id from public.social_events where title = 'RLS Churrasco'), '00000000-0000-4000-8000-000000051801', 'CONFIRMED', 0),
  ((select id from public.social_events where title = 'RLS Churrasco'), '00000000-0000-4000-8000-000000051802', 'CONFIRMED', 0);

-- Presidente vê as duas presenças.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000051901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000051901","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.social_event_presences), 2, 'PRESIDENT reads every presence');
select is(
  (select cost_per_person from public.social_event_split((select id from public.social_events where title = 'RLS Churrasco'))),
  45.00, 'the split value is the same for any reader'
);
reset role;

-- Atleta A1 vê apenas a própria presença.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000051902', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000051902","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.social_event_presences), 1, 'ATHLETE reads only their own presence');
select is(
  (select athlete_id from public.social_event_presences),
  '00000000-0000-4000-8000-000000051801'::uuid, 'the visible presence is the caller''s own'
);
select is(
  (select cost_per_person from public.social_event_split((select id from public.social_events where title = 'RLS Churrasco'))),
  45.00, 'the athlete sees the same per-person value (SC-008)'
);
select throws_ok(
  $$insert into public.social_event_presences (social_event_id, athlete_id, status)
    values ((select id from public.social_events where title = 'RLS Churrasco'),
            '00000000-0000-4000-8000-000000051801', 'DECLINED')$$,
  '42501', null, 'authenticated has no direct INSERT on social_event_presences'
);
select throws_ok(
  $$update public.social_events set total_cost = 0$$,
  '42501', null, 'authenticated has no direct UPDATE on social_events'
);
reset role;

-- Após fechar, as cotas congeladas não mudam mesmo com nova resposta rejeitada.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000051901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000051901","role":"authenticated","aal":"aal2"}', true);
select public.close_social_event((select id from public.social_events where title = 'RLS Churrasco'), gen_random_uuid());
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000051902', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000051902","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.set_event_presence((select id from public.social_events where title = 'RLS Churrasco'), 'DECLINED', 0, gen_random_uuid())$$,
  'P0001', 'EVENT_CLOSED', 'a closed event rejects further presence changes, preserving the frozen split'
);
reset role;

select * from finish();
rollback;
