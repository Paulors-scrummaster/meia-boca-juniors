-- Feature 003 · US1 (Financeiro) · T024
-- Leituras derivadas: badge de inadimplência (puramente visual — FR-006/SC-006,
-- nunca bloqueia acesso) e panorama financeiro da diretoria.

create or replace function public.athlete_delinquency_badge(athlete_uuid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.athlete_charges
      where athlete_id = athlete_uuid and status = 'OVERDUE'
    ) then 'OVERDUE'
    when exists (
      select 1 from public.athlete_charges
      where athlete_id = athlete_uuid and status = 'PENDING'
    ) then 'PENDING'
    else 'NONE'
  end;
$$;

revoke all on function public.athlete_delinquency_badge(uuid) from public, anon;
grant execute on function public.athlete_delinquency_badge(uuid) to authenticated;

-- `security_invoker` faz o RLS de `athlete_charges` valer: PRESIDENT vê todos os
-- agregados; um atleta vê apenas os próprios (demais aparecem como 0 / NONE).
create view public.finance_overview
with (security_invoker = true) as
select
  a.id as athlete_id,
  a.full_name,
  a.shirt_name,
  a.shirt_number,
  count(c.id) filter (where c.status = 'PENDING') as pending_count,
  coalesce(sum(c.amount) filter (where c.status = 'PENDING'), 0) as pending_amount,
  count(c.id) filter (where c.status = 'OVERDUE') as overdue_count,
  coalesce(sum(c.amount) filter (where c.status = 'OVERDUE'), 0) as overdue_amount,
  coalesce(
    sum(c.amount) filter (where c.status = 'PAID' and c.season_id = active.id), 0
  ) as paid_active_season_amount,
  case
    when count(c.id) filter (where c.status = 'OVERDUE') > 0 then 'OVERDUE'
    when count(c.id) filter (where c.status = 'PENDING') > 0 then 'PENDING'
    else 'NONE'
  end as badge
from public.athletes a
left join public.seasons active on active.status = 'ACTIVE'
left join public.athlete_charges c on c.athlete_id = a.id
where a.status <> 'INACTIVE'
group by a.id, a.full_name, a.shirt_name, a.shirt_number;

revoke all on public.finance_overview from anon, authenticated;
grant select on public.finance_overview to authenticated;
