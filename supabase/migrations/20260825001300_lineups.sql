create table public.allowed_formations (
  code text primary key,
  display_order integer not null unique,
  is_active boolean not null default true,
  constraint allowed_formations_code_format check (
    char_length(code) between 1 and 20 and code = btrim(code)
  ),
  constraint allowed_formations_display_order_nonnegative check (display_order >= 0)
);

insert into public.allowed_formations (code, display_order) values
  ('4-4-2', 0),
  ('4-3-3', 1),
  ('4-2-3-1', 2),
  ('3-5-2', 3);

create table public.lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on update restrict on delete restrict,
  revision integer not null,
  formation_code text not null references public.allowed_formations (code) on update restrict on delete restrict,
  status public.lineup_status not null default 'DRAFT',
  created_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  published_by uuid references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  published_at timestamptz,
  unique (match_id, revision),
  constraint lineups_revision_positive check (revision > 0),
  constraint lineups_publication_metadata check (
    (status = 'DRAFT' and published_by is null and published_at is null)
    or (status in ('PUBLISHED', 'SUPERSEDED') and published_by is not null and published_at is not null)
  )
);

create unique index lineups_one_current_publication_idx
  on public.lineups (match_id) where status = 'PUBLISHED';

create table public.lineup_players (
  lineup_id uuid not null references public.lineups (id) on update restrict on delete cascade,
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  assignment public.lineup_assignment not null,
  tactical_position text,
  position_x numeric(5, 2),
  position_y numeric(5, 2),
  display_order integer not null default 0,
  primary key (lineup_id, athlete_id),
  constraint lineup_players_display_order_nonnegative check (display_order >= 0),
  constraint lineup_players_tactical_position_format check (
    tactical_position is null
    or (char_length(tactical_position) between 1 and 30 and tactical_position = btrim(tactical_position))
  ),
  constraint lineup_players_assignment_fields check (
    (
      assignment = 'STARTER'
      and tactical_position is not null
      and position_x is not null
      and position_y is not null
      and position_x between 0 and 100
      and position_y between 0 and 100
    )
    or (
      assignment = 'RESERVE'
      and tactical_position is null
      and position_x is null
      and position_y is null
    )
  )
);

create unique index lineup_players_reserve_order_idx
  on public.lineup_players (lineup_id, display_order) where assignment = 'RESERVE';
create unique index lineup_players_starter_position_idx
  on public.lineup_players (lineup_id, tactical_position) where assignment = 'STARTER';

create or replace function private.guard_lineup_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then
      raise exception using errcode = '55000', message = 'published lineup revisions are immutable';
    end if;
    return old;
  end if;

  if not exists (
    select 1 from public.allowed_formations
    where code = new.formation_code and is_active
  ) then
    raise exception using errcode = '23514', message = 'formation must be active';
  end if;

  if tg_op = 'UPDATE' and old.status <> 'DRAFT' then
    if not (
      old.status = 'PUBLISHED'
      and new.status = 'SUPERSEDED'
      and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status')
    ) then
      raise exception using errcode = '55000', message = 'published lineup revisions are immutable';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_lineup_revision
before insert or update or delete on public.lineups
for each row execute function private.guard_lineup_revision();

create or replace function private.guard_lineup_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_lineup_id uuid := coalesce(new.lineup_id, old.lineup_id);
begin
  if not exists (
    select 1 from public.lineups where id = target_lineup_id and status = 'DRAFT'
  ) then
    raise exception using errcode = '55000', message = 'published lineup revisions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger guard_lineup_membership
before insert or update or delete on public.lineup_players
for each row execute function private.guard_lineup_membership();

alter table public.allowed_formations enable row level security;
alter table public.lineups enable row level security;
alter table public.lineup_players enable row level security;

revoke all on public.allowed_formations, public.lineups, public.lineup_players from public, anon, authenticated;
grant select on public.allowed_formations, public.lineups, public.lineup_players to authenticated;
grant insert, update, delete on public.lineups, public.lineup_players to authenticated;

create policy allowed_formations_select_active_accounts
on public.allowed_formations for select to authenticated
using (private.current_user_is_active());

create policy lineups_select_published_or_staff_aal2
on public.lineups for select to authenticated
using (
  private.current_user_is_active()
  and (
    status = 'PUBLISHED'
    or (
      private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
      and private.current_session_is_aal2()
    )
  )
);

create policy lineups_insert_staff_aal2_drafts
on public.lineups for insert to authenticated
with check (
  status = 'DRAFT'
  and created_by = auth.uid()
  and private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
);

create policy lineups_update_staff_aal2_drafts
on public.lineups for update to authenticated
using (
  status = 'DRAFT'
  and private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
)
with check (
  status = 'DRAFT'
  and private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
);

create policy lineups_delete_staff_aal2_drafts
on public.lineups for delete to authenticated
using (
  status = 'DRAFT'
  and private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
);

create policy lineup_players_select_visible_lineup
on public.lineup_players for select to authenticated
using (exists (select 1 from public.lineups where id = lineup_players.lineup_id));

create policy lineup_players_insert_staff_aal2_drafts
on public.lineup_players for insert to authenticated
with check (
  private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
  and exists (select 1 from public.lineups where id = lineup_players.lineup_id and status = 'DRAFT')
);

create policy lineup_players_update_staff_aal2_drafts
on public.lineup_players for update to authenticated
using (
  private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
  and exists (select 1 from public.lineups where id = lineup_players.lineup_id and status = 'DRAFT')
)
with check (
  private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
  and exists (select 1 from public.lineups where id = lineup_players.lineup_id and status = 'DRAFT')
);

create policy lineup_players_delete_staff_aal2_drafts
on public.lineup_players for delete to authenticated
using (
  private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
  and exists (select 1 from public.lineups where id = lineup_players.lineup_id and status = 'DRAFT')
);
