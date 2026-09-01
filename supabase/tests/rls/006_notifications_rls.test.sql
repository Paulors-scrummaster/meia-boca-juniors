begin;

select plan(15);

select policies_are(
  'public',
  'notices',
  array['notices_select_active_accounts'],
  'notices are readable but not directly writable'
);
select policies_are(
  'public',
  'push_subscriptions',
  array[
    'push_subscriptions_delete_own',
    'push_subscriptions_insert_own',
    'push_subscriptions_select_own',
    'push_subscriptions_update_own'
  ],
  'subscription ownership is enforced by RLS'
);
select table_privs_are('public', 'notices', 'authenticated', array['SELECT'], 'notice writes use the RPC');
select table_privs_are(
  'public',
  'notification_deliveries',
  'authenticated',
  array[]::text[],
  'dispatch rows remain internal only'
);
select table_privs_are(
  'public',
  'notification_events',
  'authenticated',
  array[]::text[],
  'outbox payloads remain internal only'
);
select function_privs_are(
  'public',
  'publish_notice',
  array['text','text','uuid'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users may invoke the authoritative publication contract'
);

insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000016001','notice-president@example.test'),
  ('00000000-0000-4000-8000-000000016002','notice-athlete@example.test');
insert into public.profiles(id) values
  ('00000000-0000-4000-8000-000000016001'),
  ('00000000-0000-4000-8000-000000016002');
insert into public.user_roles(user_id,role,assigned_by) values
  ('00000000-0000-4000-8000-000000016001','PRESIDENT','00000000-0000-4000-8000-000000016001'),
  ('00000000-0000-4000-8000-000000016002','ATHLETE','00000000-0000-4000-8000-000000016001');
insert into public.notices(id,title,body,published_by) values
  ('00000000-0000-4000-8000-000000016101','Treino','Treino confirmado.','00000000-0000-4000-8000-000000016001');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000016002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000016002","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.notices), 1, 'active athletes can read notices');
insert into public.push_subscriptions(user_id, provider_subscription_id)
values ('00000000-0000-4000-8000-000000016002','onesignal-athlete-device');
select is((select count(*)::integer from public.push_subscriptions), 1, 'athletes can read their own subscriptions');
select is_empty(
  $$select provider_subscription_id from public.push_subscriptions
    where user_id = '00000000-0000-4000-8000-000000016001'$$,
  'athletes cannot inspect another user provider identifier'
);
select throws_ok(
  $$insert into public.push_subscriptions(user_id, provider_subscription_id)
    values ('00000000-0000-4000-8000-000000016001','onesignal-other-device')$$,
  '42501',
  null,
  'athletes cannot create another user subscription'
);
select throws_ok(
  $$insert into public.notices(title,body,published_by)
    values ('Direto','Bloqueado','00000000-0000-4000-8000-000000016002')$$,
  '42501',
  null,
  'notice publication cannot bypass the RPC'
);
select throws_ok(
  $$select public.publish_notice('Título','Corpo',gen_random_uuid())$$,
  '42501',
  'FORBIDDEN',
  'Athlete cannot publish a notice'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000016001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000016001","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.publish_notice('Título','Corpo',gen_random_uuid())$$,
  '42501',
  'MFA_REQUIRED',
  'staff publication requires AAL2'
);
reset role;

select lives_ok(
  $$insert into public.notification_events(kind,resource_type,resource_id,deduplication_key,payload)
    values ('NOTICE_PUBLISHED','notice',gen_random_uuid(),'notice:sanitized:test',
      '{"title":"Novo aviso","body":"Consulte o mural.","route":"/app/notices"}'::jsonb)$$,
  'sanitized display payload is accepted internally'
);
select throws_ok(
  $$insert into public.notification_events(kind,resource_type,resource_id,deduplication_key,payload)
    values ('NOTICE_PUBLISHED','notice',gen_random_uuid(),'notice:unsafe:test',
      '{"providerSubscriptionId":"opaque-private-id"}'::jsonb)$$,
  null,
  null,
  'provider identifiers are rejected from event payloads'
);

select * from finish();
rollback;
