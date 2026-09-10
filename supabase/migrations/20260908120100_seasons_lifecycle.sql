-- Feature 003 · Phase 2 (Foundational) · T006
-- Estende a tabela `public.seasons` do MVP (NÃO cria entidade paralela) com um
-- ciclo de vida explícito: datas de início/fim e um status ACTIVE/CLOSED.
-- `is_active` (já usado pelo MVP e pelo índice parcial `seasons_one_active_key`)
-- permanece sincronizado com `status` por trigger, preservando "exatamente uma
-- temporada ativa". A sincronização é bidirecional: código legado que insere
-- apenas `is_active` continua funcionando (o trigger deriva `status`), e código
-- novo que informa `status` tem `is_active` derivado.

create type public.season_status as enum ('ACTIVE', 'CLOSED');

alter table public.seasons
  add column starts_on date not null default (date_trunc('year', now()))::date,
  add column ends_on date,
  add column status public.season_status;

-- Backfill determinístico das linhas existentes a partir de `year`/`is_active`.
update public.seasons
set
  starts_on = make_date(year, 1, 1),
  status = case when is_active then 'ACTIVE'::public.season_status else 'CLOSED'::public.season_status end,
  ends_on = case when is_active then null else make_date(year, 12, 31) end;

alter table public.seasons
  alter column status set not null;

-- Uma temporada ACTIVE nunca tem data de encerramento. Temporadas CLOSED
-- recebem `ends_on` de `close_season`; linhas legadas sem data são toleradas.
alter table public.seasons
  add constraint seasons_active_has_no_end_date check (
    status <> 'ACTIVE' or ends_on is null
  ),
  add constraint seasons_ends_on_not_before_starts_on check (
    ends_on is null or ends_on >= starts_on
  );

create or replace function private.sync_season_status_and_flag()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null then
      new.status := case when new.is_active then 'ACTIVE'::public.season_status else 'CLOSED'::public.season_status end;
    end if;
    new.is_active := (new.status = 'ACTIVE');
  else
    -- Sincronização bidirecional: `status` é a fonte de verdade quando o chamador
    -- o altera; caso contrário, uma escrita direta em `is_active` (código legado)
    -- deriva `status`.
    if new.status is distinct from old.status then
      new.is_active := (new.status = 'ACTIVE');
    elsif new.is_active is distinct from old.is_active then
      new.status := case when new.is_active then 'ACTIVE'::public.season_status else 'CLOSED'::public.season_status end;
    end if;
  end if;
  return new;
end;
$$;

create trigger seasons_sync_status_and_flag
before insert or update on public.seasons
for each row execute function private.sync_season_status_and_flag();
