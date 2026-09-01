create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.generate_attendance_reminders(scan_at timestamptz default statement_timestamp())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  reminder_kind public.notification_kind;
  reminder_hours integer;
  target_at timestamptz;
  generated_count integer := 0;
  event_before_count bigint;
  event_after_count bigint;
begin
  if scan_at is null then
    raise exception using errcode = '22023', message = 'scan instant is required';
  end if;

  for candidate in
    select
      mp.id as presence_id,
      mp.call_revision,
      mp.called_at,
      m.id as match_id,
      m.schedule_revision,
      case when mp.is_exceptional_call then mp.individual_deadline else m.confirmation_deadline end as applicable_deadline,
      a.user_id
    from public.match_presences mp
    join public.matches m on m.id = mp.match_id
    join public.athletes a on a.id = mp.athlete_id
    join public.profiles p on p.id = a.user_id and p.account_status = 'ACTIVE'
    join public.user_roles ur on ur.user_id = a.user_id and ur.role = 'ATHLETE'
    where m.status = 'SCHEDULED'
      and m.current_consolidation_id is null
      and mp.call_status = 'CALLED'
      and mp.presence_status = 'PENDING'
      and mp.called_at is not null
      and mp.call_revision > 0
      and (case when mp.is_exceptional_call then mp.individual_deadline else m.confirmation_deadline end) is not null
  loop
    foreach reminder_hours in array array[24, 6]
    loop
      reminder_kind := case when reminder_hours = 24 then 'DEADLINE_24H'::public.notification_kind else 'DEADLINE_6H'::public.notification_kind end;
      target_at := candidate.applicable_deadline - make_interval(hours => reminder_hours);

      if candidate.called_at <= target_at
        and scan_at >= target_at
        and scan_at < target_at + interval '10 minutes' then
        select count(*) into event_before_count from public.notification_events;
        perform private.enqueue_notification(
          reminder_kind,
          'match_presence',
          candidate.presence_id,
          'presence:' || candidate.presence_id::text
            || ':schedule:' || candidate.schedule_revision::text
            || ':call:' || candidate.call_revision::text
            || case when reminder_hours = 24 then ':deadline-24h' else ':deadline-6h' end,
          jsonb_build_object(
            'title', case when reminder_hours = 24 then 'Confirme sua presença' else 'Prazo de presença próximo' end,
            'body', case when reminder_hours = 24 then 'Falta aproximadamente um dia para o prazo.' else 'Faltam aproximadamente seis horas para o prazo.' end,
            'route', '/app/matches/' || candidate.match_id::text,
            'matchId', candidate.match_id
          ),
          array[candidate.user_id]
        );
        select count(*) into event_after_count from public.notification_events;
        if event_after_count > event_before_count then generated_count := generated_count + 1; end if;
      end if;
    end loop;
  end loop;

  return generated_count;
end;
$$;

revoke all on function private.generate_attendance_reminders(timestamptz) from public, anon, authenticated;
grant execute on function private.generate_attendance_reminders(timestamptz) to service_role;

do $$
declare
  job_exists boolean;
begin
  if to_regclass('cron.job') is not null and to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute 'select exists(select 1 from cron.job where jobname=$1)'
      into job_exists using 'generate-attendance-reminders';
    if not job_exists then
      execute 'select cron.schedule($1,$2,$3)'
        using 'generate-attendance-reminders', '*/5 * * * *', 'select private.generate_attendance_reminders(statement_timestamp())';
    end if;
  end if;
end;
$$;
