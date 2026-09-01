create or replace function public.publish_lineup(
  match_uuid uuid,
  draft_lineup_uuid uuid,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  match_record public.matches%rowtype;
  draft_record public.lineups%rowtype;
  ineligible_status public.athlete_status;
  declined_exists boolean;
  event_uuid uuid;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  select result into cached_result
  from private.command_results
  where command_name = 'publish_lineup'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  select * into match_record from public.matches where id = match_uuid for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if match_record.status <> 'SCHEDULED' or match_record.current_consolidation_id is not null then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;

  select * into draft_record from public.lineups where id = draft_lineup_uuid for update;
  if not found or draft_record.match_id <> match_uuid then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if draft_record.status <> 'DRAFT' then
    raise exception using errcode = 'P0001', message = 'LINEUP_IMMUTABLE';
  end if;
  if not exists (select 1 from public.lineup_players where lineup_id = draft_lineup_uuid and assignment = 'STARTER') then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select a.status into ineligible_status
  from public.lineup_players lp
  join public.athletes a on a.id = lp.athlete_id
  where lp.lineup_id = draft_lineup_uuid and a.status <> 'ACTIVE'
  order by a.id
  limit 1;
  if found then
    raise exception using errcode = 'P0001', message = 'ATHLETE_INELIGIBLE:' || ineligible_status::text;
  end if;

  if exists (
    select 1
    from public.lineup_players lp
    join public.athletes a on a.id = lp.athlete_id
    left join public.profiles p on p.id = a.user_id and p.account_status = 'ACTIVE'
    left join public.user_roles ur on ur.user_id = a.user_id and ur.role = 'ATHLETE'
    where lp.lineup_id = draft_lineup_uuid
      and (a.user_id is null or p.id is null or ur.user_id is null)
  ) then
    raise exception using errcode = 'P0001', message = 'ATHLETE_INELIGIBLE:NO_ACTIVE_ROLE';
  end if;

  select exists (
    select 1
    from public.lineup_players lp
    join public.match_presences mp on mp.match_id = match_uuid and mp.athlete_id = lp.athlete_id
    where lp.lineup_id = draft_lineup_uuid and mp.presence_status = 'DECLINED'
  ) into declined_exists;
  if declined_exists then
    raise exception using errcode = 'P0001', message = 'ATHLETE_INELIGIBLE:DECLINED';
  end if;

  update public.lineups
  set status = 'SUPERSEDED'
  where match_id = match_uuid and status = 'PUBLISHED';

  update public.lineups
  set status = 'PUBLISHED', published_by = auth.uid(), published_at = statement_timestamp()
  where id = draft_lineup_uuid
  returning * into draft_record;

  event_uuid := private.enqueue_notification(
    'LINEUP_PUBLISHED',
    'lineup',
    draft_record.id,
    'lineup:' || draft_record.id::text || ':revision:' || draft_record.revision::text || ':published',
    jsonb_build_object(
      'title', 'Escalação oficial publicada',
      'body', 'A escalação oficial da partida está disponível.',
      'route', '/app/matches/' || match_uuid::text || '/lineup',
      'revision', draft_record.revision
    ),
    array(
      select distinct a.user_id
      from public.athletes a
      join public.profiles p on p.id = a.user_id and p.account_status = 'ACTIVE'
      join public.user_roles ur on ur.user_id = a.user_id and ur.role = 'ATHLETE'
      where a.status <> 'INACTIVE' and a.anonymized_at is null and a.user_id is not null
    )
  );

  perform private.append_audit_log(
    'LINEUP_PUBLISHED',
    'lineup',
    draft_record.id,
    null,
    jsonb_build_object('matchId', match_uuid, 'revision', draft_record.revision),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'lineupId', draft_record.id,
    'revision', draft_record.revision,
    'publishedAt', draft_record.published_at,
    'notificationEventId', event_uuid
  );
  insert into private.command_results values (
    'publish_lineup', auth.uid(), command_idempotency_key, result_value, statement_timestamp()
  );
  return result_value;
end;
$$;

revoke all on function public.publish_lineup(uuid, uuid, uuid) from public, anon;
grant execute on function public.publish_lineup(uuid, uuid, uuid) to authenticated;
