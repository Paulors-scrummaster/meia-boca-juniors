begin;

select plan(18);

select has_table('public', 'allowed_formations', 'allowed formations table exists');
select has_table('public', 'lineups', 'versioned lineups table exists');
select has_table('public', 'lineup_players', 'lineup players table exists');
select is(
  (select string_agg(code, ',' order by display_order) from public.allowed_formations),
  '4-4-2,4-3-3,4-2-3-1,3-5-2',
  'the approved club formations are seeded in display order'
);

update public.seasons set is_active = false;
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000012001', 'lineup-president@example.test'),
  ('00000000-0000-4000-8000-000000012002', 'lineup-athlete@example.test');
insert into public.profiles (id) values
  ('00000000-0000-4000-8000-000000012001'),
  ('00000000-0000-4000-8000-000000012002');
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-000000012001', 'PRESIDENT', '00000000-0000-4000-8000-000000012001'),
  ('00000000-0000-4000-8000-000000012002', 'ATHLETE', '00000000-0000-4000-8000-000000012001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-000000012101', '00000000-0000-4000-8000-000000012002', 'Atleta Escalação', 'Escalação', 71, 'Atacante'),
  ('00000000-0000-4000-8000-000000012102', null, 'Reserva Um', 'Reserva 1', 77, 'Defensor'),
  ('00000000-0000-4000-8000-000000012103', null, 'Reserva Dois', 'Reserva 2', 78, 'Defensor');
insert into public.seasons (id, year, is_active)
values ('00000000-0000-4000-8000-000000012201', 2034, true);
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by)
values (
  '00000000-0000-4000-8000-000000012301', '00000000-0000-4000-8000-000000012201',
  'Formação FC', statement_timestamp() + interval '3 days', statement_timestamp() + interval '2 days',
  '00000000-0000-4000-8000-000000012001', '00000000-0000-4000-8000-000000012001'
);

insert into public.lineups (id, match_id, revision, formation_code, created_by)
values ('00000000-0000-4000-8000-000000012401', '00000000-0000-4000-8000-000000012301', 1, '4-4-2', '00000000-0000-4000-8000-000000012001');

select throws_ok(
  $$insert into public.lineups (match_id, revision, formation_code, created_by)
    values ('00000000-0000-4000-8000-000000012301', 1, '4-3-3', '00000000-0000-4000-8000-000000012001')$$,
  '23505', null, 'lineup revisions are unique within a match'
);
select throws_ok(
  $$insert into public.lineups (match_id, revision, formation_code, created_by)
    values ('00000000-0000-4000-8000-000000012301', 0, '4-3-3', '00000000-0000-4000-8000-000000012001')$$,
  '23514', null, 'lineup revisions must be positive'
);

update public.allowed_formations set is_active = false where code = '3-5-2';
select throws_ok(
  $$insert into public.lineups (match_id, revision, formation_code, created_by)
    values ('00000000-0000-4000-8000-000000012301', 2, '3-5-2', '00000000-0000-4000-8000-000000012001')$$,
  '23514', 'formation must be active', 'drafts reject inactive formations'
);
update public.allowed_formations set is_active = true where code = '3-5-2';

select throws_ok(
  $$insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, display_order)
    values ('00000000-0000-4000-8000-000000012401', '00000000-0000-4000-8000-000000012101', 'STARTER', 'ATA', 0)$$,
  '23514', null, 'starters require normalized tactical coordinates'
);
select throws_ok(
  $$insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order)
    values ('00000000-0000-4000-8000-000000012401', '00000000-0000-4000-8000-000000012101', 'STARTER', 'ATA', 101, 50, 0)$$,
  '23514', null, 'starter coordinates stay between zero and one hundred'
);

insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order)
values ('00000000-0000-4000-8000-000000012401', '00000000-0000-4000-8000-000000012101', 'STARTER', 'ATA', 50, 24, 0);

insert into public.lineup_players (lineup_id, athlete_id, assignment, display_order)
values ('00000000-0000-4000-8000-000000012401', '00000000-0000-4000-8000-000000012102', 'RESERVE', 0);
select throws_ok(
  $$insert into public.lineup_players (lineup_id, athlete_id, assignment, display_order)
    values ('00000000-0000-4000-8000-000000012401', '00000000-0000-4000-8000-000000012103', 'RESERVE', 0)$$,
  '23505', null, 'reserve display order is deterministic within a lineup'
);

select throws_ok(
  $$update public.lineup_players set assignment = 'RESERVE'
    where lineup_id = '00000000-0000-4000-8000-000000012401' and athlete_id = '00000000-0000-4000-8000-000000012101'$$,
  '23514', null, 'reserves cannot retain starter coordinates'
);

insert into public.lineups (id, match_id, revision, formation_code, status, created_by, published_by, published_at)
values (
  '00000000-0000-4000-8000-000000012402', '00000000-0000-4000-8000-000000012301', 2, '4-3-3', 'PUBLISHED',
  '00000000-0000-4000-8000-000000012001', '00000000-0000-4000-8000-000000012001', statement_timestamp()
);
select throws_ok(
  $$insert into public.lineups (match_id, revision, formation_code, status, created_by, published_by, published_at)
    values ('00000000-0000-4000-8000-000000012301', 3, '4-4-2', 'PUBLISHED',
      '00000000-0000-4000-8000-000000012001', '00000000-0000-4000-8000-000000012001', statement_timestamp())$$,
  '23505', null, 'only one published lineup is current per match'
);
select throws_ok(
  $$update public.lineups set formation_code = '3-5-2' where id = '00000000-0000-4000-8000-000000012402'$$,
  '55000', 'published lineup revisions are immutable', 'published lineup data cannot be edited'
);
select throws_ok(
  $$delete from public.lineups where id = '00000000-0000-4000-8000-000000012402'$$,
  '55000', 'published lineup revisions are immutable', 'published lineup history cannot be deleted'
);
select throws_ok(
  $$insert into public.lineup_players (lineup_id, athlete_id, assignment, display_order)
    values ('00000000-0000-4000-8000-000000012402', '00000000-0000-4000-8000-000000012101', 'RESERVE', 0)$$,
  '55000', 'published lineup revisions are immutable', 'published lineup membership cannot be edited'
);
select col_is_fk('public', 'lineups', 'match_id', 'lineups retain historical match references');
select col_is_fk('public', 'lineup_players', 'athlete_id', 'lineup members retain historical athlete references');
select is((select status::text from public.lineups where id = '00000000-0000-4000-8000-000000012401'), 'DRAFT', 'new lineup revisions begin as drafts');

select * from finish();
rollback;
