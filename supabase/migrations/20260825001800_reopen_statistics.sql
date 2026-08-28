create or replace function public.reopen_match_statistics(
  match_uuid uuid,
  correction_explanation text,
  command_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cached_result jsonb; match_record public.matches%rowtype; consolidation_record public.match_consolidations%rowtype;
  round_uuid uuid; result_value jsonb; normalized_explanation text;
begin
  perform private.require_president_aal2();
  normalized_explanation:=regexp_replace(btrim(coalesce(correction_explanation,'')),'[[:space:]]+',' ','g');
  if char_length(normalized_explanation) not between 1 and 500 then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  select result into cached_result from private.command_results where command_name='reopen_match_statistics'
    and actor_user_id=auth.uid() and idempotency_key=command_idempotency_key;
  if found then return cached_result; end if;
  select * into match_record from public.matches where id=match_uuid for update;
  if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
  if match_record.current_consolidation_id is null then raise exception using errcode='P0001',message='MATCH_NOT_CONSOLIDATED'; end if;
  select * into consolidation_record from public.match_consolidations where id=match_record.current_consolidation_id for update;
  select id into round_uuid from public.mvp_voting_rounds where consolidation_id=consolidation_record.id for update;
  update public.mvp_awards set invalidated_at=statement_timestamp() where voting_round_id=round_uuid and invalidated_at is null;
  update public.mvp_voting_rounds set status='INVALIDATED',invalidated_at=statement_timestamp()
    where id=round_uuid and status in ('OPEN','CLOSED');
  update public.match_consolidations set status='INVALIDATED',invalidated_by=auth.uid(),invalidated_at=statement_timestamp()
    where id=consolidation_record.id;
  update public.matches set current_consolidation_id=null,updated_by=auth.uid(),updated_at=statement_timestamp() where id=match_uuid;
  perform private.append_audit_log('MATCH_STATISTICS_REOPENED','match',match_uuid,
    jsonb_build_object('consolidationId',consolidation_record.id),
    jsonb_build_object('currentConsolidationId',null,'explanationProvided',true),command_idempotency_key);
  result_value:=jsonb_build_object('matchId',match_uuid,'invalidatedConsolidationId',consolidation_record.id,
    'invalidatedVotingRoundId',round_uuid,'reopenedAt',statement_timestamp());
  insert into private.command_results values('reopen_match_statistics',auth.uid(),command_idempotency_key,result_value,statement_timestamp());
  return result_value;
end;
$$;
revoke all on function public.reopen_match_statistics(uuid,text,uuid) from public,anon;
grant execute on function public.reopen_match_statistics(uuid,text,uuid) to authenticated;
