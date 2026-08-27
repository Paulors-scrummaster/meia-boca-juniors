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
