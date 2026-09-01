create or replace function public.get_user_roles(target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  resulting_roles jsonb;
begin
  if not private.has_role('PRESIDENT') or not private.current_session_is_aal2() then
    raise exception using errcode = '42501', message = 'President with AAL2 required';
  end if;

  perform 1
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'target profile not found';
  end if;

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb)
  into resulting_roles
  from public.user_roles
  where user_id = target_user_id;

  return jsonb_build_object('userId', target_user_id, 'roles', resulting_roles);
end;
$$;

revoke all on function public.get_user_roles(uuid) from public, anon;
grant execute on function public.get_user_roles(uuid) to authenticated;
