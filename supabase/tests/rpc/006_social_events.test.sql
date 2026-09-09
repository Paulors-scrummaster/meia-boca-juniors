begin;

select plan(25);

-- Contrato -------------------------------------------------------------------
select has_table('public', 'social_events', 'social_events table exists');
select has_table('public', 'social_event_presences', 'social_event_presences table exists');
select has_function('public', 'create_social_event', array['text', 'timestamptz', 'text', 'numeric', 'uuid'], 'create_social_event exists');
select has_function('public', 'update_social_event', array['uuid', 'text', 'timestamptz', 'text', 'numeric', 'uuid'], 'update_social_event exists');
select has_function('public', 'set_event_presence', array['uuid', 'text', 'integer', 'uuid'], 'set_event_presence exists');
select has_function('public', 'close_social_event', array['uuid', 'uuid'], 'close_social_event exists');
select has_function('public', 'social_event_split', array['uuid'], 'social_event_split exists');
select has_function('public', 'social_event_participants', array['uuid'], 'social_event_participants exists');

-- Atletas de teste ----------------------------------------------------------
insert into public.athletes (id, full_name, shirt_name, shirt_number, primary_position)
select
  ('00000000-0000-4000-8000-0000000501' || to_char(g, 'FM00'))::uuid,
  'Atleta Social ' || g, 'Social' || g, 30 + g, 'Meio'
from generate_series(1, 15) g;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000050901', 'social-president@example.test'),
  ('00000000-0000-4000-8000-000000050902', 'social-athlete@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000509%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-000000050901', 'PRESIDENT', '00000000-0000-4000-8000-000000050901'),
  ('00000000-0000-4000-8000-000000050902', 'ATHLETE', '00000000-0000-4000-8000-000000050901');
update public.athletes set user_id = '00000000-0000-4000-8000-000000050902'
where id = '00000000-0000-4000-8000-000000050101';

-- Cenário 2 do quickstart: R$ 600,00 / 15 pessoas (10 confirmados, 5 com +1) ---
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050901', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050901","role":"authenticated","aal":"aal2"}', true);
select is(
  (public.create_social_event('Churrasco da Vitoria', now() + interval '2 days', 'Sede', 600.00, gen_random_uuid()) ->> 'status'),
  'OPEN', 'president opens a social event'
);
reset role;

-- captura o id

insert into public.social_event_presences (social_event_id, athlete_id, status, guests_count)
select
  (select id from public.social_events where title = 'Churrasco da Vitoria'),
  ('00000000-0000-4000-8000-0000000501' || to_char(g, 'FM00'))::uuid,
  'CONFIRMED',
  case when g <= 5 then 1 else 0 end
from generate_series(1, 10) g;

select is(
  (select people_count from public.social_event_split((select id from public.social_events where title = 'Churrasco da Vitoria'))),
  15, 'split people_count counts athletes + guests'
);
select is(
  (select cost_per_person from public.social_event_split((select id from public.social_events where title = 'Churrasco da Vitoria'))),
  40.00, 'every confirmed participant sees R$ 40,00'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050901","role":"authenticated","aal":"aal2"}', true);
select is(
  (public.close_social_event((select id from public.social_events where title = 'Churrasco da Vitoria'), gen_random_uuid()) ->> 'peopleCount'),
  '15', 'close reports the frozen head count'
);
reset role;

select is(
  (select sum(frozen_share) from public.social_event_presences
   where social_event_id = (select id from public.social_events where title = 'Churrasco da Vitoria') and status = 'CONFIRMED'),
  600.00, 'Σ frozen shares equals total_cost exactly (SC-002)'
);
select is(
  (select status::text from public.social_events where id = (select id from public.social_events where title = 'Churrasco da Vitoria')),
  'CLOSED', 'event is CLOSED after consolidation'
);
select is(
  (select split_unavailable from public.social_event_split((select id from public.social_events where title = 'Churrasco da Vitoria'))),
  false, 'a closed event returns its frozen split'
);

-- Fechar de novo -> EVENT_CLOSED
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050901","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.close_social_event((select id from public.social_events where title = 'Churrasco da Vitoria'), gen_random_uuid())$$,
  'P0001', 'EVENT_CLOSED', 'a closed event cannot be closed again'
);
reset role;

-- Presença após fechado -> EVENT_CLOSED
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050902', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050902', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050902","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.set_event_presence((select id from public.social_events where title = 'Churrasco da Vitoria'), 'DECLINED', 0, gen_random_uuid())$$,
  'P0001', 'EVENT_CLOSED', 'presence changes are rejected once the event is closed'
);
reset role;

-- Rateio não-divisível: R$ 100,00 / 7 pessoas -------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050901","role":"authenticated","aal":"aal2"}', true);
select public.create_social_event('Resenha Menor', now() + interval '3 days', 'Quadra', 100.00, gen_random_uuid());
reset role;
insert into public.social_event_presences (social_event_id, athlete_id, status, guests_count)
select (select id from public.social_events where title = 'Resenha Menor'), ('00000000-0000-4000-8000-0000000501' || to_char(g, 'FM00'))::uuid, 'CONFIRMED', 0
from generate_series(1, 7) g;

select is(
  (select people_count from public.social_event_split((select id from public.social_events where title = 'Resenha Menor'))),
  7, 'non-divisible split counts 7 people'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050901","role":"authenticated","aal":"aal2"}', true);
select public.close_social_event((select id from public.social_events where title = 'Resenha Menor'), gen_random_uuid());
reset role;
select is(
  (select sum(frozen_share) from public.social_event_presences
   where social_event_id = (select id from public.social_events where title = 'Resenha Menor') and status = 'CONFIRMED'),
  100.00, 'non-divisible Σ shares still equals total_cost exactly (SC-002)'
);
select is(
  (select count(distinct frozen_share)::integer from public.social_event_presences
   where social_event_id = (select id from public.social_events where title = 'Resenha Menor') and status = 'CONFIRMED'),
  2, 'the remainder cent is spread across the first athletes only'
);

-- Zero confirmados -> VALIDATION_ERROR ------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050901","role":"authenticated","aal":"aal2"}', true);
select public.create_social_event('Evento Vazio', now() + interval '4 days', 'Sede', 200.00, gen_random_uuid());
reset role;
select is(
  (select split_unavailable from public.social_event_split((select id from public.social_events where title = 'Evento Vazio'))),
  true, 'a zero-confirmed event reports the split as unavailable (FR-016)'
);
select is(
  (select cost_per_person from public.social_event_split((select id from public.social_events where title = 'Evento Vazio'))),
  null::numeric, 'no cost_per_person is shown with nobody confirmed'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050901', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050901","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.close_social_event((select id from public.social_events where title = 'Evento Vazio'), gen_random_uuid())$$,
  '22023', 'VALIDATION_ERROR', 'a zero-confirmed event cannot be closed'
);
reset role;

-- RBAC ---------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050902', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000050902', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000050902","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.create_social_event('x', now(), 'y', 1, gen_random_uuid())$$,
  '42501', 'FORBIDDEN', 'athletes cannot create social events'
);
select throws_ok(
  $$select public.set_event_presence((select id from public.social_events where title = 'Resenha Menor'), 'CONFIRMED', 25, gen_random_uuid())$$,
  '22023', 'VALIDATION_ERROR', 'guests_count above 20 is rejected'
);
reset role;

select * from finish();
rollback;
