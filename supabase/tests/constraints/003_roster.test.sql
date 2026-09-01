begin;

select plan(16);

select has_table('public', 'athletes', 'athletes remains the roster source of truth');
select has_function('public', 'create_athlete', array['text', 'text', 'smallint', 'text', 'athlete_status', 'text', 'uuid'], 'audited athlete creation RPC exists');
select has_function('public', 'update_athlete', array['uuid', 'text', 'text', 'smallint', 'text', 'text', 'uuid'], 'audited athlete update RPC exists');
select has_function('public', 'set_athlete_status', array['uuid', 'athlete_status', 'smallint', 'uuid'], 'atomic athlete status RPC exists');
select has_function('public', 'anonymize_athlete', array['uuid', 'uuid'], 'atomic anonymization RPC exists');

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000003001', 'roster-president@example.test'),
  ('00000000-0000-4000-8000-000000003002', 'roster-member@example.test');

insert into public.profiles (id)
values
  ('00000000-0000-4000-8000-000000003001'),
  ('00000000-0000-4000-8000-000000003002');

insert into public.user_roles (user_id, role, assigned_by)
values
  ('00000000-0000-4000-8000-000000003001', 'PRESIDENT', '00000000-0000-4000-8000-000000003001'),
  ('00000000-0000-4000-8000-000000003002', 'ATHLETE', '00000000-0000-4000-8000-000000003001');

insert into public.athletes (
  id, user_id, full_name, shirt_name, shirt_number, primary_position
) values (
  '00000000-0000-4000-8000-000000003101',
  '00000000-0000-4000-8000-000000003002',
  'Atleta Histórico', 'Histórico', 23, 'Meio-campo'
);

select throws_ok(
  $$insert into public.athletes (full_name, shirt_name, shirt_number, primary_position)
    values ('A', 'Nome', 24, 'Ataque')$$,
  '23514', null, 'full name minimum length is enforced'
);

select throws_ok(
  $$insert into public.athletes (full_name, shirt_name, shirt_number, primary_position)
    values ('Nome  Duplicado', 'Nome', 24, 'Ataque')$$,
  '23514', null, 'normalized whitespace is enforced'
);

select throws_ok(
  $$insert into public.athletes (full_name, shirt_name, shirt_number, primary_position)
    values ('Outro Atleta', 'Outro', 23, 'Defesa')$$,
  '23505', null, 'shirt number is unique among non-inactive athletes'
);

select lives_ok(
  $$insert into public.athletes (
      full_name, shirt_name, shirt_number, primary_position, status, inactivated_at
    ) values ('Atleta Inativo', 'Inativo', 23, 'Defesa', 'INACTIVE', statement_timestamp())$$,
  'inactive athletes release their shirt number'
);

select throws_ok(
  $$insert into public.athletes (
      full_name, shirt_name, shirt_number, primary_position, status, inactivated_at
    ) values ('Atleta Ativo', 'Ativo', 24, 'Defesa', 'ACTIVE', statement_timestamp())$$,
  '23514', null, 'active athletes cannot have an inactivation timestamp'
);

select throws_ok(
  $$insert into public.athletes (
      full_name, shirt_name, shirt_number, primary_position, status
    ) values ('Inativo Sem Data', 'Sem Data', 24, 'Defesa', 'INACTIVE')$$,
  '23514', null, 'inactive athletes require an inactivation timestamp'
);

select throws_ok(
  $$update public.athletes
    set anonymized_at = statement_timestamp()
    where id = '00000000-0000-4000-8000-000000003101'$$,
  '23514', null, 'anonymization requires inactive unlinked identity and no photo'
);

insert into public.athlete_invites (
  id, athlete_id, email_normalized, created_by
) values (
  '00000000-0000-4000-8000-000000003201',
  '00000000-0000-4000-8000-000000003101',
  'historical@example.test',
  '00000000-0000-4000-8000-000000003001'
);

select throws_ok(
  $$delete from public.athletes where id = '00000000-0000-4000-8000-000000003101'$$,
  '23503', null, 'historical foreign keys restrict physical athlete deletion'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000003001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000003001","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$select public.anonymize_athlete(
    '00000000-0000-4000-8000-000000003101',
    '00000000-0000-4000-8000-000000003299'
  )$$,
  'President can anonymize atomically without deleting history'
);
reset role;

select ok(
  (select status = 'INACTIVE'
      and inactivated_at is not null
      and anonymized_at is not null
      and user_id is null
      and photo_path is null
   from public.athletes where id = '00000000-0000-4000-8000-000000003101'),
  'anonymized athlete satisfies the complete lifecycle state'
);

select is(
  (select count(*)::integer from public.athlete_invites
    where athlete_id = '00000000-0000-4000-8000-000000003101'),
  1,
  'anonymization preserves historical references'
);

select * from finish();
rollback;
