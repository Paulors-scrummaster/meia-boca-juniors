begin;

select plan(20);

select has_table('public', 'seasons', 'seasons table exists');
select has_table('public', 'matches', 'matches table exists');
select has_table('public', 'match_presences', 'match presences table exists');
select has_table('public', 'presence_justifications', 'protected justifications table exists');

update public.seasons set is_active = false;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000007001', 'attendance-president@example.test'),
  ('00000000-0000-4000-8000-000000007002', 'attendance-athlete@example.test');

insert into public.profiles (id)
values
  ('00000000-0000-4000-8000-000000007001'),
  ('00000000-0000-4000-8000-000000007002');

insert into public.user_roles (user_id, role, assigned_by)
values
  ('00000000-0000-4000-8000-000000007001', 'PRESIDENT', '00000000-0000-4000-8000-000000007001'),
  ('00000000-0000-4000-8000-000000007002', 'ATHLETE', '00000000-0000-4000-8000-000000007001');

insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position)
values (
  '00000000-0000-4000-8000-000000007101',
  '00000000-0000-4000-8000-000000007002',
  'Atleta Presença', 'Presença', 41, 'Atacante'
);

insert into public.seasons (id, year, is_active)
values ('00000000-0000-4000-8000-000000007201', 2031, true);

select throws_ok(
  $$insert into public.seasons (year, is_active) values (2032, true)$$,
  '23505', null, 'only one season can be active'
);

select throws_ok(
  $$insert into public.seasons (year) values (999)$$,
  '23514', null, 'season year must have four digits'
);

insert into public.matches (
  id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by
) values (
  '00000000-0000-4000-8000-000000007301',
  '00000000-0000-4000-8000-000000007201',
  'Adversário Fictício', statement_timestamp() + interval '3 days',
  statement_timestamp() + interval '2 days',
  '00000000-0000-4000-8000-000000007001',
  '00000000-0000-4000-8000-000000007001'
);

select throws_ok(
  $$insert into public.matches (
      season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by
    ) values (
      '00000000-0000-4000-8000-000000007201', 'Prazo Inválido',
      statement_timestamp() + interval '1 day', statement_timestamp() + interval '2 days',
      '00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000007001'
    )$$,
  '23514', null, 'confirmation deadline must precede kickoff'
);

select throws_ok(
  $$insert into public.matches (
      season_id, opponent_name, match_date, confirmation_deadline, schedule_revision,
      created_by, updated_by
    ) values (
      '00000000-0000-4000-8000-000000007201', 'Revisão Inválida',
      statement_timestamp() + interval '2 days', statement_timestamp() + interval '1 day', 0,
      '00000000-0000-4000-8000-000000007001', '00000000-0000-4000-8000-000000007001'
    )$$,
  '23514', null, 'schedule revision must be positive'
);

insert into public.match_presences (
  id, match_id, athlete_id, call_status, called_at, call_revision
) values (
  '00000000-0000-4000-8000-000000007401',
  '00000000-0000-4000-8000-000000007301',
  '00000000-0000-4000-8000-000000007101',
  'CALLED', statement_timestamp(), 1
);

select throws_ok(
  $$insert into public.match_presences (
      match_id, athlete_id, call_status, called_at, call_revision
    ) values (
      '00000000-0000-4000-8000-000000007301',
      '00000000-0000-4000-8000-000000007101', 'CALLED', statement_timestamp(), 1
    )$$,
  '23505', null, 'one presence row exists per match and athlete'
);

select throws_ok(
  $$update public.match_presences set call_revision = 0
    where id = '00000000-0000-4000-8000-000000007401'$$,
  '23514', null, 'called rows require a positive call revision'
);

select throws_ok(
  $$update public.match_presences set called_at = null
    where id = '00000000-0000-4000-8000-000000007401'$$,
  '23514', null, 'positive call revisions require called_at'
);

select throws_ok(
  $$update public.match_presences
    set is_exceptional_call = true, individual_deadline = null
    where id = '00000000-0000-4000-8000-000000007401'$$,
  '23514', null, 'exceptional calls require an individual deadline'
);

select throws_ok(
  $$update public.match_presences
    set is_exceptional_call = true,
        individual_deadline = statement_timestamp() - interval '1 minute'
    where id = '00000000-0000-4000-8000-000000007401'$$,
  '23514', null, 'exceptional deadline must follow the call timestamp'
);

select throws_ok(
  $test$do $block$
    begin
      update public.match_presences
      set is_exceptional_call = true,
          individual_deadline = statement_timestamp() + interval '4 days'
      where id = '00000000-0000-4000-8000-000000007401';
      set constraints match_presences_integrity_at_commit immediate;
    end
    $block$;$test$,
  '23514', 'exceptional deadline must not exceed kickoff',
  'exceptional deadline cannot exceed match kickoff'
);

select throws_ok(
  $test$do $block$
    begin
      update public.match_presences
      set presence_status = 'DECLINED', responded_at = statement_timestamp()
      where id = '00000000-0000-4000-8000-000000007401';
      set constraints match_presences_integrity_at_commit immediate;
    end
    $block$;$test$,
  '23514', 'declined presence requires a reason',
  'declined state requires a protected justification at commit'
);

insert into public.presence_justifications (presence_id, reason, created_by)
values (
  '00000000-0000-4000-8000-000000007401', 'Compromisso familiar',
  '00000000-0000-4000-8000-000000007002'
);

select throws_ok(
  $$update public.presence_justifications set reason = '  '
    where presence_id = '00000000-0000-4000-8000-000000007401'$$,
  '23514', null, 'refusal reason cannot be blank'
);

select throws_ok(
  $$update public.match_presences set presence_status = 'INVALID'
    where id = '00000000-0000-4000-8000-000000007401'$$,
  '22P02', null, 'presence states are constrained by the enum'
);

select throws_ok(
  $$delete from public.matches where id = '00000000-0000-4000-8000-000000007301'$$,
  '23503', null, 'presence history restricts physical match deletion'
);

select throws_ok(
  $$delete from public.athletes where id = '00000000-0000-4000-8000-000000007101'$$,
  '23503', null, 'presence history restricts physical athlete deletion'
);

select is(
  (select count(*)::integer from public.presence_justifications
   where presence_id = '00000000-0000-4000-8000-000000007401'),
  1,
  'valid protected reason is stored separately from presence state'
);

select * from finish();
rollback;
