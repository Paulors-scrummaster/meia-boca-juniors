-- Feature 003 · US2 (Resenha / Churrasco) · T042
-- Leituras derivadas do rateio.

-- Valor por pessoa: derivado enquanto OPEN, congelado quando CLOSED. Todo
-- participante confirmado vê o mesmo valor (FR-013 / SC-008). Sem dado pessoal,
-- então pode ser `security definer`.
create or replace function public.social_event_split(event_uuid uuid)
returns table (people_count integer, cost_per_person numeric, split_unavailable boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  event_record public.social_events%rowtype;
  confirmed_people integer;
begin
  select * into event_record from public.social_events where id = event_uuid;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  if event_record.status = 'CLOSED' then
    return query select
      event_record.frozen_people_count,
      event_record.frozen_cost_per_person,
      false;
    return;
  end if;

  select coalesce(sum(1 + guests_count), 0)::integer into confirmed_people
  from public.social_event_presences
  where social_event_id = event_uuid and status = 'CONFIRMED';

  if confirmed_people = 0 then
    return query select 0, null::numeric, true;
  else
    return query select
      confirmed_people,
      round(event_record.total_cost / confirmed_people, 2),
      false;
  end if;
end;
$$;

revoke all on function public.social_event_split(uuid) from public, anon;
grant execute on function public.social_event_split(uuid) to authenticated;

-- Lista de participantes com a cota individual (derivada enquanto OPEN, congelada
-- quando CLOSED). `security invoker` → o RLS de `social_event_presences` aplica.
create or replace function public.social_event_participants(event_uuid uuid)
returns table (
  athlete_id uuid,
  shirt_name text,
  status public.event_presence_status,
  guests_count integer,
  share numeric
)
language sql
stable
set search_path = ''
as $$
  select
    p.athlete_id,
    a.shirt_name,
    p.status,
    p.guests_count,
    case
      when p.status <> 'CONFIRMED' then null
      when p.frozen_share is not null then p.frozen_share
      else round(
        (select e.total_cost from public.social_events e where e.id = event_uuid)
        / nullif((
            select sum(1 + gp.guests_count)
            from public.social_event_presences gp
            where gp.social_event_id = event_uuid and gp.status = 'CONFIRMED'
          ), 0)
        * (1 + p.guests_count),
        2
      )
    end as share
  from public.social_event_presences p
  join public.athletes a on a.id = p.athlete_id
  where p.social_event_id = event_uuid
  order by a.shirt_name;
$$;

revoke all on function public.social_event_participants(uuid) from public, anon;
grant execute on function public.social_event_participants(uuid) to authenticated;
