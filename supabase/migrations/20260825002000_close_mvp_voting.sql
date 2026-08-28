create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.close_mvp_voting(voting_round_uuid uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare round_record public.mvp_voting_rounds%rowtype; maximum_votes integer; winner_count integer; result_value jsonb;
begin
  if auth.uid() is not null then perform private.require_president_aal2(); end if;
  select * into round_record from public.mvp_voting_rounds where id=voting_round_uuid for update;
  if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
  if round_record.status='CLOSED' then
    return jsonb_build_object('votingRoundId',round_record.id,'status','CLOSED','winnerCount',
      (select count(*) from public.mvp_awards where voting_round_id=round_record.id and invalidated_at is null));
  end if;
  if round_record.status<>'OPEN' then raise exception using errcode='P0001',message='ROUND_INVALIDATED'; end if;
  if statement_timestamp()<round_record.closes_at then raise exception using errcode='P0001',message='DEADLINE_OPEN'; end if;
  select max(vote_total) into maximum_votes from (
    select voted_athlete_id,count(*)::integer vote_total from public.mvp_votes where voting_round_id=round_record.id group by voted_athlete_id
  ) totals;
  if coalesce(maximum_votes,0)>0 then
    insert into public.mvp_awards(voting_round_id,athlete_id,vote_count)
      select round_record.id,voted_athlete_id,count(*)::integer from public.mvp_votes
      where voting_round_id=round_record.id group by voted_athlete_id having count(*)=maximum_votes
      on conflict(voting_round_id,athlete_id) do nothing;
  end if;
  update public.mvp_voting_rounds set status='CLOSED',closed_at=statement_timestamp() where id=round_record.id;
  select count(*) into winner_count from public.mvp_awards where voting_round_id=round_record.id and invalidated_at is null;
  if auth.uid() is not null then
    perform private.append_audit_log('MVP_VOTING_CLOSED','mvp_voting_round',round_record.id,
      jsonb_build_object('status','OPEN'),jsonb_build_object('status','CLOSED','winnerCount',winner_count),gen_random_uuid());
  end if;
  result_value:=jsonb_build_object('votingRoundId',round_record.id,'status','CLOSED','winnerCount',winner_count,'topVoteCount',coalesce(maximum_votes,0));
  return result_value;
end;
$$;
revoke all on function public.close_mvp_voting(uuid) from public,anon;
grant execute on function public.close_mvp_voting(uuid) to authenticated,service_role;

create or replace function private.close_expired_mvp_voting()
returns integer language plpgsql security definer set search_path = '' as $$
declare target record; closed_count integer:=0;
begin
  for target in select id from public.mvp_voting_rounds where status='OPEN' and closes_at<=statement_timestamp() order by closes_at
  loop perform public.close_mvp_voting(target.id); closed_count:=closed_count+1; end loop;
  return closed_count;
end;
$$;
revoke all on function private.close_expired_mvp_voting() from public,anon,authenticated;
grant execute on function private.close_expired_mvp_voting() to service_role;

do $$
declare job_exists boolean;
begin
  if to_regclass('cron.job') is not null and to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute 'select exists(select 1 from cron.job where jobname=$1)'
      into job_exists using 'close-expired-mvp-voting';
    if not job_exists then
      execute 'select cron.schedule($1,$2,$3)'
        using 'close-expired-mvp-voting','*/5 * * * *','select private.close_expired_mvp_voting()';
    end if;
  end if;
end;
$$;
