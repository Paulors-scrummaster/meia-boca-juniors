-- Feature 003 · Phase 2 (Foundational) · T009
-- Extrai o corpo de escrita de `public.consolidate_match` para uma rotina interna
-- `private.write_consolidation(...)`, para que a US3 (`finalize_sumula`) reutilize
-- exatamente a mesma cadeia de consolidação — `match_consolidations` +
-- `match_goals` como fonte única. **Sem mudança de comportamento**: o caller
-- continua fazendo checagem de papel/AAL2, cache de idempotência e audit log com
-- seu próprio `command_name` / action code. A regressão é garantida por
-- `supabase/tests/rpc/003_statistics_voting_commands.test.sql` (inalterado) e
-- `supabase/tests/rpc/007_write_consolidation_refactor.test.sql`.

create or replace function private.write_consolidation(
  match_record public.matches,
  lineup_record public.lineups,
  mbj_score_input integer,
  opponent_score_input integer,
  goals_input jsonb,
  command_idempotency_key uuid,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  consolidation_record public.match_consolidations%rowtype;
  round_record public.mvp_voting_rounds%rowtype;
  goal jsonb;
  scorer uuid;
  assistant uuid;
  own_goal boolean;
  next_revision integer;
  event_uuid uuid;
begin
  select coalesce(max(revision), 0) + 1 into next_revision
  from public.match_consolidations where match_id = match_record.id;

  insert into public.match_consolidations (
    match_id, lineup_id, revision, mbj_score, opponent_score, idempotency_key, consolidated_by
  ) values (
    match_record.id, lineup_record.id, next_revision, mbj_score_input, opponent_score_input,
    command_idempotency_key, actor_user_id
  )
  returning * into consolidation_record;

  for goal in select value from jsonb_array_elements(goals_input) loop
    scorer := nullif(goal ->> 'scorerAthleteId', '')::uuid;
    assistant := nullif(goal ->> 'assistantAthleteId', '')::uuid;
    own_goal := coalesce((goal ->> 'isOpponentOwnGoal')::boolean, false);
    if (scorer is not null and not exists (
          select 1 from public.lineup_players where lineup_id = lineup_record.id and athlete_id = scorer))
      or (assistant is not null and not exists (
          select 1 from public.lineup_players where lineup_id = lineup_record.id and athlete_id = assistant)) then
      raise exception using errcode = '22023', message = 'ATHLETE_NOT_IN_CONSOLIDATED_LINEUP';
    end if;
    insert into public.match_goals (
      consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, is_opponent_own_goal, created_by
    ) values (
      consolidation_record.id, scorer, assistant, (goal ->> 'sequence')::integer, own_goal, actor_user_id
    );
  end loop;

  insert into public.mvp_voting_rounds (consolidation_id, opens_at, closes_at, created_by)
  values (
    consolidation_record.id, statement_timestamp(), statement_timestamp() + interval '24 hours', actor_user_id
  )
  returning * into round_record;

  update public.matches
  set status = 'COMPLETED',
      current_consolidation_id = consolidation_record.id,
      updated_by = actor_user_id,
      updated_at = statement_timestamp()
  where id = match_record.id;

  event_uuid := private.enqueue_notification(
    'VOTING_OPENED', 'mvp_voting_round', round_record.id,
    'mvp-round:' || round_record.id::text || ':opened',
    jsonb_build_object(
      'title', 'Votação aberta', 'body', 'Vote no Craque do Jogo.',
      'route', '/app/mvp-voting', 'roundId', round_record.id
    ),
    array(
      select distinct a.user_id
      from public.athletes a
      join public.profiles p on p.id = a.user_id and p.account_status = 'ACTIVE'
      join public.user_roles ur on ur.user_id = a.user_id and ur.role = 'ATHLETE'
      where a.status <> 'INACTIVE'
    )
  );

  return jsonb_build_object(
    'matchId', match_record.id,
    'consolidationId', consolidation_record.id,
    'lineupId', lineup_record.id,
    'revision', next_revision,
    'votingRoundId', round_record.id,
    'opensAt', round_record.opens_at,
    'closesAt', round_record.closes_at,
    'notificationEventId', event_uuid
  );
end;
$$;

revoke all on function private.write_consolidation(public.matches, public.lineups, integer, integer, jsonb, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.write_consolidation(public.matches, public.lineups, integer, integer, jsonb, uuid, uuid)
  to service_role;

-- `consolidate_match` fica como caller fino: mesmas checagens, mesma assinatura,
-- mesmo `command_name` de cache e mesmo action code de auditoria.
create or replace function public.consolidate_match(
  match_uuid uuid,
  mbj_score_input integer,
  opponent_score_input integer,
  goals_input jsonb,
  command_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cached_result jsonb;
  match_record public.matches%rowtype;
  lineup_record public.lineups%rowtype;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then raise exception using errcode='22023', message='VALIDATION_ERROR'; end if;
  select result into cached_result from private.command_results
    where command_name='consolidate_match' and actor_user_id=auth.uid() and idempotency_key=command_idempotency_key;
  if found then return cached_result; end if;
  if mbj_score_input < 0 or opponent_score_input < 0 or jsonb_typeof(goals_input) <> 'array'
    or jsonb_array_length(goals_input) <> mbj_score_input then
    raise exception using errcode='22023', message='VALIDATION_ERROR';
  end if;

  select * into match_record from public.matches where id=match_uuid for update;
  if not found then raise exception using errcode='P0002', message='NOT_FOUND'; end if;
  if match_record.status='CANCELLED' or match_record.current_consolidation_id is not null then
    raise exception using errcode='P0001', message='MATCH_LOCKED';
  end if;
  if match_record.match_date > statement_timestamp() then raise exception using errcode='P0001', message='MATCH_NOT_STARTED'; end if;
  select * into lineup_record from public.lineups where match_id=match_uuid and status='PUBLISHED' for share;
  if not found then raise exception using errcode='P0001', message='PUBLISHED_LINEUP_REQUIRED'; end if;

  result_value := private.write_consolidation(
    match_record, lineup_record, mbj_score_input, opponent_score_input, goals_input,
    command_idempotency_key, auth.uid()
  );

  perform private.append_audit_log('MATCH_CONSOLIDATED','match',match_uuid,null,
    jsonb_build_object(
      'consolidationId', (result_value->>'consolidationId'),
      'lineupId', lineup_record.id,
      'revision', (result_value->>'revision')::integer
    ),
    command_idempotency_key);
  insert into private.command_results values('consolidate_match',auth.uid(),command_idempotency_key,result_value,statement_timestamp());
  return result_value;
end;
$$;
revoke all on function public.consolidate_match(uuid,integer,integer,jsonb,uuid) from public,anon;
grant execute on function public.consolidate_match(uuid,integer,integer,jsonb,uuid) to authenticated;
