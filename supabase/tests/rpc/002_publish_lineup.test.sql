begin;

select plan(18);

update public.seasons set is_active = false;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000013001', 'lineup-president-rpc@example.test'),
  ('00000000-0000-4000-8000-000000013002', 'lineup-coach-rpc@example.test'),
  ('00000000-0000-4000-8000-000000013003', 'lineup-active-rpc@example.test'),
  ('00000000-0000-4000-8000-000000013004', 'lineup-injured-rpc@example.test'),
  ('00000000-0000-4000-8000-000000013005', 'lineup-suspended-rpc@example.test'),
  ('00000000-0000-4000-8000-000000013006', 'lineup-inactive-rpc@example.test'),
  ('00000000-0000-4000-8000-000000013007', 'lineup-declined-rpc@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-00000001300%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-000000013001', 'PRESIDENT', '00000000-0000-4000-8000-000000013001'),
  ('00000000-0000-4000-8000-000000013002', 'COACH', '00000000-0000-4000-8000-000000013001'),
  ('00000000-0000-4000-8000-000000013003', 'ATHLETE', '00000000-0000-4000-8000-000000013001'),
  ('00000000-0000-4000-8000-000000013004', 'ATHLETE', '00000000-0000-4000-8000-000000013001'),
  ('00000000-0000-4000-8000-000000013005', 'ATHLETE', '00000000-0000-4000-8000-000000013001'),
  ('00000000-0000-4000-8000-000000013007', 'ATHLETE', '00000000-0000-4000-8000-000000013001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position, status, inactivated_at) values
  ('00000000-0000-4000-8000-000000013101', '00000000-0000-4000-8000-000000013003', 'Ativo RPC', 'Ativo', 72, 'Ataque', 'ACTIVE', null),
  ('00000000-0000-4000-8000-000000013102', '00000000-0000-4000-8000-000000013004', 'Lesionado RPC', 'Lesionado', 73, 'Defesa', 'INJURED', null),
  ('00000000-0000-4000-8000-000000013103', '00000000-0000-4000-8000-000000013005', 'Suspenso RPC', 'Suspenso', 74, 'Meio', 'SUSPENDED', null),
  ('00000000-0000-4000-8000-000000013104', '00000000-0000-4000-8000-000000013006', 'Inativo RPC', 'Inativo', 75, 'Defesa', 'INACTIVE', statement_timestamp()),
  ('00000000-0000-4000-8000-000000013105', '00000000-0000-4000-8000-000000013007', 'Recusou RPC', 'Recusou', 76, 'Ataque', 'ACTIVE', null);
insert into public.seasons (id, year, is_active) values ('00000000-0000-4000-8000-000000013201', 2035, true);
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by)
values ('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013201', 'Publicação FC', statement_timestamp() + interval '3 days', statement_timestamp() + interval '2 days', '00000000-0000-4000-8000-000000013001', '00000000-0000-4000-8000-000000013001');
insert into public.match_presences (match_id, athlete_id, call_status, presence_status, called_at, call_revision, responded_at)
values ('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013105', 'CALLED', 'DECLINED', statement_timestamp(), 1, statement_timestamp());
insert into public.presence_justifications (presence_id, reason, created_by)
select id, 'Indisponível', '00000000-0000-4000-8000-000000013007' from public.match_presences where athlete_id = '00000000-0000-4000-8000-000000013105';

insert into public.lineups (id, match_id, revision, formation_code, created_by) values
  ('00000000-0000-4000-8000-000000013401', '00000000-0000-4000-8000-000000013301', 1, '4-4-2', '00000000-0000-4000-8000-000000013002'),
  ('00000000-0000-4000-8000-000000013402', '00000000-0000-4000-8000-000000013301', 2, '4-3-3', '00000000-0000-4000-8000-000000013002'),
  ('00000000-0000-4000-8000-000000013403', '00000000-0000-4000-8000-000000013301', 3, '3-5-2', '00000000-0000-4000-8000-000000013002'),
  ('00000000-0000-4000-8000-000000013404', '00000000-0000-4000-8000-000000013301', 4, '4-2-3-1', '00000000-0000-4000-8000-000000013002'),
  ('00000000-0000-4000-8000-000000013405', '00000000-0000-4000-8000-000000013301', 5, '4-4-2', '00000000-0000-4000-8000-000000013002');
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order) values
  ('00000000-0000-4000-8000-000000013401', '00000000-0000-4000-8000-000000013101', 'STARTER', 'ATA', 50, 20, 0),
  ('00000000-0000-4000-8000-000000013402', '00000000-0000-4000-8000-000000013102', 'STARTER', 'DEF', 50, 70, 0),
  ('00000000-0000-4000-8000-000000013403', '00000000-0000-4000-8000-000000013103', 'STARTER', 'MEI', 50, 50, 0),
  ('00000000-0000-4000-8000-000000013404', '00000000-0000-4000-8000-000000013104', 'STARTER', 'DEF', 50, 70, 0),
  ('00000000-0000-4000-8000-000000013405', '00000000-0000-4000-8000-000000013105', 'STARTER', 'ATA', 50, 20, 0);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000013003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000013003","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.lineups where match_id = '00000000-0000-4000-8000-000000013301'), 0, 'Athlete cannot read staff drafts');
select throws_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013401', '00000000-0000-4000-8000-000000013501')$$, '42501', 'FORBIDDEN', 'Athlete cannot publish');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000013002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000013002","role":"authenticated","aal":"aal1"}', true);
select throws_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013401', '00000000-0000-4000-8000-000000013502')$$, '42501', 'MFA_REQUIRED', 'staff publication requires AAL2');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000013002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000013002","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.lineups where match_id = '00000000-0000-4000-8000-000000013301'), 5, 'AAL2 staff can read every draft for the match');
select throws_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013402', '00000000-0000-4000-8000-000000013503')$$, 'P0001', 'ATHLETE_INELIGIBLE:INJURED', 'injured athlete is rejected');
select throws_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013403', '00000000-0000-4000-8000-000000013504')$$, 'P0001', 'ATHLETE_INELIGIBLE:SUSPENDED', 'suspended athlete is rejected');
select throws_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013404', '00000000-0000-4000-8000-000000013505')$$, 'P0001', 'ATHLETE_INELIGIBLE:INACTIVE', 'inactive athlete is rejected');
select throws_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013405', '00000000-0000-4000-8000-000000013506')$$, 'P0001', 'ATHLETE_INELIGIBLE:DECLINED', 'declined athlete is rejected');
select lives_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013401', '00000000-0000-4000-8000-000000013507')$$, 'eligible draft publishes');
select lives_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013401', '00000000-0000-4000-8000-000000013507')$$, 'publication retry is idempotent');
reset role;

select is((select count(*)::integer from public.lineups where match_id = '00000000-0000-4000-8000-000000013301' and status = 'PUBLISHED'), 1, 'one current publication exists');
select is((select count(*)::integer from public.notification_events where kind = 'LINEUP_PUBLISHED'), 1, 'retry creates one publication event');
select is((select count(*)::integer from public.audit_logs where action = 'LINEUP_PUBLISHED'), 1, 'publication is audited once');

insert into public.lineups (id, match_id, revision, formation_code, created_by) values
('00000000-0000-4000-8000-000000013406', '00000000-0000-4000-8000-000000013301', 6, '4-3-3', '00000000-0000-4000-8000-000000013001');
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order)
values ('00000000-0000-4000-8000-000000013406', '00000000-0000-4000-8000-000000013101', 'STARTER', 'ATA', 60, 20, 0);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000013001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000013001","role":"authenticated","aal":"aal2"}', true);
select lives_ok($$select public.publish_lineup('00000000-0000-4000-8000-000000013301', '00000000-0000-4000-8000-000000013406', '00000000-0000-4000-8000-000000013508')$$, 'republishing creates a new official revision');
reset role;
select is((select status::text from public.lineups where id = '00000000-0000-4000-8000-000000013401'), 'SUPERSEDED', 'previous publication is superseded atomically');
select is((select count(*)::integer from public.notification_events where kind = 'LINEUP_PUBLISHED'), 2, 'each publication revision creates one event');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000013003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000013003","role":"authenticated","aal":"aal1"}', true);
select is((select max(revision)::integer from public.published_lineup_view), 6, 'authenticated Athlete sees the current official revision');
select is((select count(*)::integer from public.published_lineup_view where match_id = '00000000-0000-4000-8000-000000013301'), 1, 'published view exposes only current members');
reset role;

select * from finish();
rollback;
