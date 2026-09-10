-- Feature 003 · Phase 2 (Foundational) · T011
-- Ponto de extensão (no-op) para a avaliação de troféus, chamado pela cadeia de
-- consolidação. A lógica real por temporada é entregue na US4
-- (20260908160400_evaluate_trophies.sql), que faz `create or replace` desta função.
-- Existir agora como stub mantém US3 (finalize_sumula) independentemente testável.

create or replace function private.evaluate_trophies(
  season_id uuid,
  athlete_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Substituído pela implementação real na US4.
  return;
end;
$$;

revoke all on function private.evaluate_trophies(uuid, uuid[]) from public, anon, authenticated;
grant execute on function private.evaluate_trophies(uuid, uuid[]) to service_role;
