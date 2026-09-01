-- Identidades exclusivamente fictícias para desenvolvimento e testes locais.
-- Nenhuma senha conhecida é criada; os fluxos de acesso chegam com a história de identidade.

insert into auth.users (id, email, email_confirmed_at)
values
  ('10000000-0000-4000-8000-000000000001', 'president@mbj.example.invalid', statement_timestamp()),
  ('10000000-0000-4000-8000-000000000002', 'coach@mbj.example.invalid', statement_timestamp()),
  ('10000000-0000-4000-8000-000000000003', 'multi-role@mbj.example.invalid', statement_timestamp()),
  ('10000000-0000-4000-8000-000000000004', 'athlete@mbj.example.invalid', statement_timestamp()),
  ('10000000-0000-4000-8000-000000000005', 'inactive-athlete@mbj.example.invalid', statement_timestamp())
on conflict (id) do nothing;

insert into public.profiles (id)
values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004'),
  ('10000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;

insert into public.seasons (id, year, is_active)
values ('30000000-0000-4000-8000-000000000001', 2026, true)
on conflict (id) do nothing;

insert into public.matches (
  id,
  season_id,
  opponent_name,
  competition_name,
  location_name,
  match_date,
  confirmation_deadline,
  schedule_revision,
  created_by,
  updated_by
)
values (
  '30000000-0000-4000-8000-000000000101',
  '30000000-0000-4000-8000-000000000001',
  'Atlético Fictício',
  'Amistoso local',
  'Campo de testes',
  '2026-09-05T18:00:00Z',
  '2026-09-04T18:00:00Z',
  2,
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

insert into public.user_roles (user_id, role, assigned_by)
values
  ('10000000-0000-4000-8000-000000000001', 'PRESIDENT', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'COACH', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000003', 'COACH', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000003', 'ATHLETE', '10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000004', 'ATHLETE', '10000000-0000-4000-8000-000000000001')
on conflict (user_id, role) do nothing;

insert into public.athletes (
  id,
  user_id,
  full_name,
  shirt_name,
  shirt_number,
  primary_position,
  status,
  inactivated_at
)
values
  (
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    'Marcos Exemplo',
    'Marcos',
    8,
    'Meio-campo',
    'ACTIVE',
    null
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    'André Fictício',
    'André',
    10,
    'Atacante',
    'ACTIVE',
    null
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000005',
    'Carlos Inativo',
    'Carlos',
    99,
    'Defensor',
    'INACTIVE',
    '2026-01-01T12:00:00Z'
  )
on conflict (id) do nothing;

insert into public.match_presences (
  id,
  match_id,
  athlete_id,
  call_status,
  presence_status,
  called_at,
  call_revision,
  responded_at,
  last_changed_by
)
values
  (
    '30000000-0000-4000-8000-000000000201',
    '30000000-0000-4000-8000-000000000101',
    '20000000-0000-4000-8000-000000000003',
    'CALLED',
    'CONFIRMED',
    '2026-08-26T12:00:00Z',
    1,
    '2026-08-26T13:00:00Z',
    '10000000-0000-4000-8000-000000000003'
  ),
  (
    '30000000-0000-4000-8000-000000000202',
    '30000000-0000-4000-8000-000000000101',
    '20000000-0000-4000-8000-000000000004',
    'CALLED',
    'DECLINED',
    '2026-08-27T12:00:00Z',
    2,
    '2026-08-27T13:00:00Z',
    '10000000-0000-4000-8000-000000000004'
  )
on conflict (id) do nothing;

insert into public.presence_justifications (presence_id, reason, created_by)
values (
  '30000000-0000-4000-8000-000000000202',
  'Compromisso pessoal fictício',
  '10000000-0000-4000-8000-000000000004'
)
on conflict (presence_id) do nothing;

insert into public.lineups (id, match_id, revision, formation_code, created_by)
values
  (
    '40000000-0000-4000-8000-000000000101',
    '30000000-0000-4000-8000-000000000101',
    1,
    '4-3-3',
    '10000000-0000-4000-8000-000000000002'
  ),
  (
    '40000000-0000-4000-8000-000000000102',
    '30000000-0000-4000-8000-000000000101',
    2,
    '4-2-3-1',
    '10000000-0000-4000-8000-000000000002'
  )
on conflict (id) do nothing;

insert into public.lineup_players (
  lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order
)
values
  (
    '40000000-0000-4000-8000-000000000101',
    '20000000-0000-4000-8000-000000000003',
    'STARTER', 'MEI', 50, 48, 0
  ),
  (
    '40000000-0000-4000-8000-000000000102',
    '20000000-0000-4000-8000-000000000003',
    'STARTER', 'MEI', 50, 48, 0
  )
on conflict (lineup_id, athlete_id) do nothing;

update public.lineups
set status = 'PUBLISHED',
    published_by = '10000000-0000-4000-8000-000000000002',
    published_at = '2026-08-28T18:00:00Z'
where id = '40000000-0000-4000-8000-000000000101'
  and status = 'DRAFT';
