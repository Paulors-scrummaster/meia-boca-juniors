begin;

select plan(7);

select is(
  (select count(*)::integer from public.profiles where id::text like '10000000-0000-4000-8000-%'),
  5,
  'seed creates five fictitious profiles'
);

select is(
  (select count(*)::integer from auth.users where email like '%@mbj.example.invalid'),
  5,
  'all seeded identities use the reserved invalid domain'
);

select ok(
  exists (
    select 1 from public.user_roles
    where user_id = '10000000-0000-4000-8000-000000000001' and role = 'PRESIDENT'
  ),
  'seed includes a President'
);

select ok(
  exists (
    select 1 from public.user_roles
    where user_id = '10000000-0000-4000-8000-000000000002' and role = 'COACH'
  ),
  'seed includes a Coach'
);

select is(
  (select count(*)::integer from public.user_roles where user_id = '10000000-0000-4000-8000-000000000003'),
  2,
  'seed includes an additive Coach and Athlete identity'
);

select ok(
  exists (
    select 1 from public.user_roles
    where user_id = '10000000-0000-4000-8000-000000000004' and role = 'ATHLETE'
  ),
  'seed includes an Athlete identity'
);

select ok(
  exists (
    select 1
    from public.athletes athlete
    where athlete.user_id = '10000000-0000-4000-8000-000000000005'
      and athlete.status = 'INACTIVE'
      and athlete.inactivated_at is not null
      and not exists (
        select 1 from public.user_roles role
        where role.user_id = athlete.user_id and role.role = 'ATHLETE'
      )
  ),
  'inactive athlete has no active Athlete role'
);

select * from finish();
rollback;
