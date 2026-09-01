create type public.consolidation_status as enum ('VALID', 'INVALIDATED');

create table public.match_consolidations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on update restrict on delete restrict,
  lineup_id uuid not null references public.lineups (id) on update restrict on delete restrict,
  revision integer not null,
  mbj_score integer not null,
  opponent_score integer not null,
  status public.consolidation_status not null default 'VALID',
  idempotency_key uuid not null,
  consolidated_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  consolidated_at timestamptz not null default statement_timestamp(),
  invalidated_by uuid references public.profiles (id) on update restrict on delete restrict,
  invalidated_at timestamptz,
  unique (match_id, revision),
  unique (match_id, idempotency_key),
  constraint match_consolidations_revision_positive check (revision > 0),
  constraint match_consolidations_scores_nonnegative check (mbj_score >= 0 and opponent_score >= 0),
  constraint match_consolidations_invalidation_metadata check (
    (status = 'VALID' and invalidated_by is null and invalidated_at is null)
    or (status = 'INVALIDATED' and invalidated_by is not null and invalidated_at is not null)
  )
);

alter table public.matches add constraint matches_current_consolidation_fk
  foreign key (current_consolidation_id) references public.match_consolidations (id)
  on update restrict on delete restrict deferrable initially deferred;

create unique index match_consolidations_one_valid_idx
  on public.match_consolidations (match_id) where status = 'VALID';

create table public.match_goals (
  id uuid primary key default gen_random_uuid(),
  consolidation_id uuid not null references public.match_consolidations (id) on update restrict on delete restrict,
  scorer_athlete_id uuid references public.athletes (id) on update restrict on delete restrict,
  assistant_athlete_id uuid references public.athletes (id) on update restrict on delete restrict,
  sequence_number integer not null,
  is_opponent_own_goal boolean not null default false,
  created_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (consolidation_id, sequence_number),
  constraint match_goals_sequence_positive check (sequence_number > 0),
  constraint match_goals_scorer_rules check (
    (is_opponent_own_goal and scorer_athlete_id is null and assistant_athlete_id is null)
    or (not is_opponent_own_goal and scorer_athlete_id is not null)
  ),
  constraint match_goals_assistant_differs check (assistant_athlete_id is null or assistant_athlete_id <> scorer_athlete_id)
);

create table public.mvp_voting_rounds (
  id uuid primary key default gen_random_uuid(),
  consolidation_id uuid not null unique references public.match_consolidations (id) on update restrict on delete restrict,
  status public.voting_round_status not null default 'OPEN',
  opens_at timestamptz not null default statement_timestamp(),
  closes_at timestamptz not null,
  created_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  invalidated_at timestamptz,
  closed_at timestamptz,
  constraint mvp_voting_round_exact_window check (closes_at = opens_at + interval '24 hours'),
  constraint mvp_voting_round_lifecycle check (
    (status = 'OPEN' and invalidated_at is null and closed_at is null)
    or (status = 'CLOSED' and invalidated_at is null and closed_at is not null)
    or (status = 'INVALIDATED' and invalidated_at is not null)
  )
);

create table public.mvp_votes (
  id uuid primary key default gen_random_uuid(),
  voting_round_id uuid not null references public.mvp_voting_rounds (id) on update restrict on delete restrict,
  voter_athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  voted_athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (voting_round_id, voter_athlete_id),
  constraint mvp_votes_no_self_vote check (voter_athlete_id <> voted_athlete_id)
);

create table public.mvp_awards (
  voting_round_id uuid not null references public.mvp_voting_rounds (id) on update restrict on delete restrict,
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  vote_count integer not null,
  awarded_at timestamptz not null default statement_timestamp(),
  invalidated_at timestamptz,
  primary key (voting_round_id, athlete_id),
  constraint mvp_awards_vote_count_nonnegative check (vote_count >= 0)
);

create or replace function private.guard_match_consolidation_immutability()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception using errcode = '55000', message = 'consolidation history is immutable'; end if;
  if old.status = 'VALID' and new.status = 'INVALIDATED'
    and (to_jsonb(new) - array['status','invalidated_by','invalidated_at']) = (to_jsonb(old) - array['status','invalidated_by','invalidated_at']) then
    return new;
  end if;
  raise exception using errcode = '55000', message = 'consolidation history is immutable';
end;
$$;
create trigger guard_match_consolidation_immutability before update or delete on public.match_consolidations
for each row execute function private.guard_match_consolidation_immutability();

create or replace function private.reject_statistics_history_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin raise exception using errcode = '55000', message = 'statistics history is immutable'; end;
$$;
create trigger guard_match_goal_immutability before update or delete on public.match_goals
for each row execute function private.reject_statistics_history_mutation();
create trigger guard_mvp_vote_immutability before update or delete on public.mvp_votes
for each row execute function private.reject_statistics_history_mutation();

create or replace function private.validate_consolidation_goal_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_id uuid; expected integer;
begin
  if tg_table_name = 'match_consolidations' then
    target_id := coalesce(new.id, old.id);
  else
    target_id := coalesce(new.consolidation_id, old.consolidation_id);
  end if;
  select mbj_score into expected from public.match_consolidations where id = target_id;
  if expected is not null and expected <> (select count(*) from public.match_goals where consolidation_id = target_id) then
    raise exception using errcode = '23514', message = 'goal count must equal MBJ score';
  end if;
  return null;
end;
$$;
create constraint trigger match_consolidations_goal_count_consistency after insert or update on public.match_consolidations
deferrable initially deferred for each row execute function private.validate_consolidation_goal_count();
create constraint trigger match_goals_score_consistency after insert or update or delete on public.match_goals
deferrable initially deferred for each row execute function private.validate_consolidation_goal_count();

create or replace function private.require_president_aal2()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role('PRESIDENT') then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  if not private.current_session_is_aal2() then raise exception using errcode = '42501', message = 'MFA_REQUIRED'; end if;
end;
$$;

alter table public.match_consolidations enable row level security;
alter table public.match_goals enable row level security;
alter table public.mvp_voting_rounds enable row level security;
alter table public.mvp_votes enable row level security;
alter table public.mvp_awards enable row level security;
revoke all on public.match_consolidations, public.match_goals, public.mvp_voting_rounds, public.mvp_votes, public.mvp_awards from public, anon, authenticated;
grant select on public.match_consolidations, public.match_goals, public.mvp_voting_rounds, public.mvp_votes, public.mvp_awards to authenticated;
create policy match_consolidations_select_active_accounts on public.match_consolidations for select to authenticated using (private.current_user_is_active());
create policy match_goals_select_active_accounts on public.match_goals for select to authenticated using (private.current_user_is_active());
create policy mvp_voting_rounds_select_active_accounts on public.mvp_voting_rounds for select to authenticated using (private.current_user_is_active());
create policy mvp_votes_select_own on public.mvp_votes for select to authenticated using (
  private.has_role('ATHLETE') and exists (select 1 from public.athletes a where a.id = voter_athlete_id and a.user_id = auth.uid())
);
create policy mvp_awards_select_active_accounts on public.mvp_awards for select to authenticated using (private.current_user_is_active());
create policy lineups_select_current_consolidated_revision on public.lineups for select to authenticated using (
  private.current_user_is_active() and exists (
    select 1 from public.match_consolidations c
    join public.matches m on m.current_consolidation_id=c.id
    where c.lineup_id=lineups.id and c.status='VALID'
  )
);
