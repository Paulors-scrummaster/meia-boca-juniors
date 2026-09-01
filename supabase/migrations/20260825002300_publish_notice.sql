create or replace function public.publish_notice(
  title_input text,
  body_input text,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  normalized_title text;
  normalized_body text;
  notice_record public.notices%rowtype;
  event_uuid uuid;
  result_value jsonb;
begin
  perform private.require_staff_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result
  from private.command_results
  where command_name = 'publish_notice'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  normalized_title := regexp_replace(btrim(coalesce(title_input, '')), '[[:space:]]+', ' ', 'g');
  normalized_body := btrim(coalesce(body_input, ''));
  if char_length(normalized_title) not between 1 and 100
    or char_length(normalized_body) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  insert into public.notices (title, body, published_by)
  values (normalized_title, normalized_body, auth.uid())
  returning * into notice_record;

  event_uuid := private.enqueue_notification(
    'NOTICE_PUBLISHED',
    'notice',
    notice_record.id,
    'notice:' || notice_record.id::text || ':published',
    jsonb_build_object(
      'title', 'Novo aviso',
      'body', 'Consulte o mural para ver o novo comunicado.',
      'route', '/app/notices',
      'noticeId', notice_record.id
    ),
    array(
      select distinct p.id
      from public.profiles p
      join public.user_roles ur on ur.user_id = p.id
      where p.account_status = 'ACTIVE'
    )
  );

  perform private.append_audit_log(
    'NOTICE_PUBLISHED',
    'notice',
    notice_record.id,
    null,
    jsonb_build_object('titleLength', char_length(notice_record.title), 'bodyLength', char_length(notice_record.body)),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'id', notice_record.id,
    'title', notice_record.title,
    'body', notice_record.body,
    'publishedBy', notice_record.published_by,
    'publishedAt', notice_record.published_at,
    'notificationEventId', event_uuid
  );
  insert into private.command_results values (
    'publish_notice', auth.uid(), command_idempotency_key, result_value, statement_timestamp()
  );
  return result_value;
end;
$$;

revoke all on function public.publish_notice(text, text, uuid) from public, anon;
grant execute on function public.publish_notice(text, text, uuid) to authenticated;
