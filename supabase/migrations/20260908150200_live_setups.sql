-- Feature 003 · US3 (Súmula Live) · T057
-- `live_match_setups`: 1:1 com a partida marcada para registro ao vivo. Só existe se
-- COACH/PRESIDENT habilitou o ao vivo (B6 `enable_live_recording`); a tela de cronômetro
-- só aparece quando há setup (FR-029, cenário 6).
--
-- Escrita apenas por RPC `security definer` (revogada de `authenticated`). O gatilho
-- `private.guard_live_setup_transition` reforça, no banco, as transições de status
-- documentadas em data-model.md §"Transições":
--   RECORDING → IN_REVIEW  (end_live_recording)
--   IN_REVIEW → FINALIZED  (finalize_sumula — só COACH/PRESIDENT+AAL2)
--   qualquer não-final → CANCELLED  (cancel_live_recording)
-- `FINALIZED` e `CANCELLED` são finais. Atualizações que não mexem no status
-- (reatribuição de Registrador enquanto RECORDING, espelho `pending_sync`) continuam
-- permitidas enquanto o setup não está final.

create table public.live_match_setups (
  match_id uuid primary key references public.matches (id) on update restrict on delete restrict,
  recorder_user_id uuid not null references public.profiles (id) on update restrict on delete restrict,
  status public.live_sumula_status not null default 'RECORDING',
  pending_sync boolean not null default false,
  starting_goalkeeper_athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  enabled_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint live_match_setups_updated_after_created check (updated_at >= created_at)
);

create index live_match_setups_recorder_idx on public.live_match_setups (recorder_user_id);
create index live_match_setups_status_idx on public.live_match_setups (status);

create or replace function private.guard_live_setup_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'live setup history is immutable';
  end if;

  -- Sem mudança de status: permitido enquanto o setup não está finalizado/cancelado.
  if new.status = old.status then
    if old.status in ('FINALIZED', 'CANCELLED') then
      raise exception using errcode = '55000', message = 'live setup is finalized';
    end if;
    return new;
  end if;

  -- Transições válidas.
  if (old.status = 'RECORDING' and new.status in ('IN_REVIEW', 'CANCELLED'))
    or (old.status = 'IN_REVIEW' and new.status in ('FINALIZED', 'CANCELLED')) then
    return new;
  end if;

  raise exception using errcode = '23514', message = 'invalid live sumula status transition';
end;
$$;

create trigger guard_live_setup_transition
before update or delete on public.live_match_setups
for each row execute function private.guard_live_setup_transition();

alter table public.live_match_setups enable row level security;
revoke all on public.live_match_setups from anon, authenticated;
grant select on public.live_match_setups to authenticated;

create policy live_match_setups_select_active_accounts on public.live_match_setups
  for select to authenticated
  using (private.current_user_is_active());
