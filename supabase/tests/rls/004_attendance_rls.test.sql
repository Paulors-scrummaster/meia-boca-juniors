begin;

select plan(18);

update public.seasons set is_active = false;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000008001', 'president-attendance@example.test'),
  ('00000000-0000-4000-8000-000000008002', 'coach-attendance@example.test'),
  ('00000000-0000-4000-8000-000000008003', 'owner-attendance@example.test'),
  ('00000000-0000-4000-8000-000000008004', 'other-attendance@example.test');

insert into public.profiles (id)
select id from auth.users where id::text like '00000000-0000-4000-8000-00000000800%';

insert into public.user_roles (user_id, role, assigned_by)
values
  ('00000000-0000-4000-8000-000000008001', 'PRESIDENT', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008002', 'COACH', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008003', 'ATHLETE', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008004', 'ATHLETE', '00000000-0000-4000-8000-000000008001');

insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position)
values
  ('00000000-0000-4000-8000-000000008101', '00000000-0000-4000-8000-000000008003', 'Atleta Dono', 'Dono', 51, 'Ataque'),
  ('00000000-0000-4000-8000-000000008102', '00000000-0000-4000-8000-000000008004', 'Outro Atleta', 'Outro', 52, 'Defesa');

insert into public.seasons (id, year, is_active)
values ('00000000-0000-4000-8000-000000008201', 2032, true);

insert into public.matches (
  id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by
) values
  ('00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008201', 'Partida Aberta', statement_timestamp() + interval '2 days', statement_timestamp() + interval '1 day', '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008302', '00000000-0000-4000-8000-000000008201', 'Partida Fechada', statement_timestamp() + interval '1 day', statement_timestamp() - interval '1 hour', '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001'),
  ('00000000-0000-4000-8000-000000008303', '00000000-0000-4000-8000-000000008201', 'Partida Cancelada', statement_timestamp() + interval '2 days', statement_timestamp() + interval '1 day', '00000000-0000-4000-8000-000000008001', '00000000-0000-4000-8000-000000008001');

update public.matches set status = 'CANCELLED' where id = '00000000-0000-4000-8000-000000008303';

insert into public.match_presences (
  id, match_id, athlete_id, call_status, called_at, call_revision
) values
  ('00000000-0000-4000-8000-000000008401', '00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008101', 'CALLED', statement_timestamp(), 1),
  ('00000000-0000-4000-8000-000000008402', '00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008102', 'CALLED', statement_timestamp(), 1),
  ('00000000-0000-4000-8000-000000008403', '00000000-0000-4000-8000-000000008302', '00000000-0000-4000-8000-000000008101', 'CALLED', statement_timestamp(), 1),
  ('00000000-0000-4000-8000-000000008404', '00000000-0000-4000-8000-000000008303', '00000000-0000-4000-8000-000000008101', 'CALLED', statement_timestamp(), 1);

insert into public.presence_justifications (presence_id, reason, created_by)
values
  ('00000000-0000-4000-8000-000000008401', 'Razão privada do dono', '00000000-0000-4000-8000-000000008003'),
  ('00000000-0000-4000-8000-000000008402', 'Razão privada de outro', '00000000-0000-4000-8000-000000008004');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000008003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000008003","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.match_presences where match_id in ('00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008302', '00000000-0000-4000-8000-000000008303')), 4, 'Athlete can read roster-visible presence states');
select is((select count(*)::integer from public.presence_justifications), 1, 'Athlete reads only own protected reason');
select is((select reason from public.presence_justifications where presence_id = '00000000-0000-4000-8000-000000008401'), 'Razão privada do dono', 'owner reads own reason');
select throws_ok(
  $$update public.match_presences set presence_status = 'CONFIRMED'
    where id = '00000000-0000-4000-8000-000000008401'$$,
  '42501', null, 'Athlete cannot bypass response RPC with a direct update'
);
select throws_ok(
  $$select public.respond_to_call('00000000-0000-4000-8000-000000008302', 'CONFIRMED', null, '00000000-0000-4000-8000-000000008501')$$,
  'P0001', 'DEADLINE_CLOSED', 'direct RPC request after deadline is denied'
);
select throws_ok(
  $$select public.respond_to_call('00000000-0000-4000-8000-000000008303', 'CONFIRMED', null, '00000000-0000-4000-8000-000000008502')$$,
  'P0001', 'MATCH_LOCKED', 'cancelled match denies athlete response'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000008004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000008004","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.presence_justifications where presence_id = '00000000-0000-4000-8000-000000008401'), 0, 'another Athlete cannot read owner reason');
select is((select count(*)::integer from public.roster_presence_view where match_id in ('00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008302', '00000000-0000-4000-8000-000000008303')), 4, 'roster projection exposes states');
select is((select count(*)::integer from public.staff_attendance_view), 0, 'Athlete cannot read staff attendance view');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000008002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000008002","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.presence_justifications where presence_id in ('00000000-0000-4000-8000-000000008401', '00000000-0000-4000-8000-000000008402')), 2, 'Coach role can read protected reasons');
select is((select count(*)::integer from public.staff_attendance_view), 0, 'staff view requires AAL2');
select throws_ok(
  $$select public.admin_set_presence('00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008101', 'CONFIRMED', null, 'Correção', '00000000-0000-4000-8000-000000008503')$$,
  '42501', 'MFA_REQUIRED', 'Coach without AAL2 cannot override attendance'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000008002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000008002","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.staff_attendance_view where match_id in ('00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008302', '00000000-0000-4000-8000-000000008303')), 4, 'Coach with AAL2 reads staff view');
select lives_ok(
  $$select public.admin_set_presence('00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008101', 'CONFIRMED', null, 'Confirmação por telefone', '00000000-0000-4000-8000-000000008504')$$,
  'Coach with AAL2 can override an unlocked match'
);
select throws_ok(
  $$select public.admin_set_presence('00000000-0000-4000-8000-000000008303', '00000000-0000-4000-8000-000000008101', 'CONFIRMED', null, 'Cancelada', '00000000-0000-4000-8000-000000008505')$$,
  'P0001', 'MATCH_LOCKED', 'staff cannot override a cancelled match'
);
reset role;

update public.matches set current_consolidation_id = '00000000-0000-4000-8000-000000008601'
where id = '00000000-0000-4000-8000-000000008301';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000008001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000008001","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.admin_set_presence('00000000-0000-4000-8000-000000008301', '00000000-0000-4000-8000-000000008101', 'DECLINED', 'Lesão', 'Após consolidar', '00000000-0000-4000-8000-000000008506')$$,
  'P0001', 'MATCH_LOCKED', 'consolidation pointer locks staff attendance writes'
);
select throws_ok(
  $$delete from public.matches where id = '00000000-0000-4000-8000-000000008301'$$,
  '42501', null, 'staff cannot physically delete match history'
);
select is((select count(*)::integer from public.next_match_view), 1, 'authenticated caller sees the minimal next-match projection');
reset role;

select * from finish();
rollback;
