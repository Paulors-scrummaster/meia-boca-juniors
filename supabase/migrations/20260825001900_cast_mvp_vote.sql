create or replace function public.cast_mvp_vote(
  voting_round_uuid uuid,
  candidate_athlete_uuid uuid,
  command_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cached_result jsonb; round_record public.mvp_voting_rounds%rowtype; consolidation_record public.match_consolidations%rowtype;
  voter_uuid uuid; vote_record public.mvp_votes%rowtype; result_value jsonb;
begin
  if not private.has_role('ATHLETE') then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  select id into voter_uuid from public.athletes where user_id=auth.uid() and status<>'INACTIVE' and anonymized_at is null;
  if not found then raise exception using errcode='42501',message='FORBIDDEN'; end if;
  select result into cached_result from private.command_results where command_name='cast_mvp_vote'
    and actor_user_id=auth.uid() and idempotency_key=command_idempotency_key;
  if found then return cached_result; end if;
  select * into round_record from public.mvp_voting_rounds where id=voting_round_uuid for update;
  if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
  select * into consolidation_record from public.match_consolidations where id=round_record.consolidation_id;
  if round_record.status<>'OPEN' or statement_timestamp()>=round_record.closes_at
    or consolidation_record.status<>'VALID'
    or not exists(select 1 from public.matches where id=consolidation_record.match_id and current_consolidation_id=consolidation_record.id) then
    raise exception using errcode='P0001',message='DEADLINE_CLOSED';
  end if;
  if candidate_athlete_uuid=voter_uuid then raise exception using errcode='22023',message='SELF_VOTE_FORBIDDEN'; end if;
  if not exists(select 1 from public.lineup_players where lineup_id=consolidation_record.lineup_id and athlete_id=candidate_athlete_uuid) then
    raise exception using errcode='22023',message='CANDIDATE_NOT_ELIGIBLE';
  end if;
  begin
    insert into public.mvp_votes(voting_round_id,voter_athlete_id,voted_athlete_id)
      values(voting_round_uuid,voter_uuid,candidate_athlete_uuid) returning * into vote_record;
  exception when unique_violation then raise exception using errcode='23505',message='VOTE_ALREADY_CAST'; end;
  result_value:=jsonb_build_object('voteId',vote_record.id,'votingRoundId',voting_round_uuid,'createdAt',vote_record.created_at);
  insert into private.command_results values('cast_mvp_vote',auth.uid(),command_idempotency_key,result_value,statement_timestamp());
  return result_value;
end;
$$;
revoke all on function public.cast_mvp_vote(uuid,uuid,uuid) from public,anon;
grant execute on function public.cast_mvp_vote(uuid,uuid,uuid) to authenticated;
