begin;

select plan(39);

select has_table('public', 'notices', 'notices table exists');
select has_table('public', 'push_subscriptions', 'push subscriptions table exists');
select col_is_fk('public', 'notices', 'published_by', 'notices retain their author');
select col_is_fk('public', 'push_subscriptions', 'user_id', 'subscriptions belong to a profile');
select col_is_unique(
  'public',
  'push_subscriptions',
  array['provider_subscription_id'],
  'provider subscription identifiers are globally unique'
);
select col_is_unique(
  'public',
  'notification_deliveries',
  array['event_id', 'user_id'],
  'each event has at most one delivery per recipient'
);

select throws_ok(
  $$insert into public.notices (title, body, published_by)
    values ('', 'Corpo', gen_random_uuid())$$,
  null,
  null,
  'blank notice titles are rejected'
);
select throws_ok(
  $$insert into public.notices (title, body, published_by)
    values (repeat('T', 101), 'Corpo', gen_random_uuid())$$,
  null,
  null,
  'notice titles are bounded to one hundred characters'
);
select throws_ok(
  $$insert into public.notices (title, body, published_by)
    values ('Título', repeat('C', 2001), gen_random_uuid())$$,
  null,
  null,
  'notice bodies are bounded to two thousand characters'
);
select throws_ok(
  $$insert into public.push_subscriptions (user_id, provider_subscription_id)
    values (gen_random_uuid(), ' short-id ')$$,
  null,
  null,
  'subscription identifiers must be normalized and bounded'
);

select has_function(
  'private',
  'generate_attendance_reminders',
  array['timestamp with time zone'],
  'the deterministic reminder scan exists'
);
select function_privs_are(
  'private',
  'generate_attendance_reminders',
  array['timestamp with time zone'],
  'authenticated',
  array[]::text[],
  'authenticated clients cannot run reminder scans'
);
select function_privs_are(
  'private',
  'claim_notification_deliveries',
  array['integer'],
  'authenticated',
  array[]::text[],
  'authenticated clients cannot claim dispatch work'
);
select function_privs_are(
  'private',
  'complete_notification_delivery',
  array['uuid','text','text','timestamp with time zone'],
  'authenticated',
  array[]::text[],
  'authenticated clients cannot complete dispatch work'
);

select has_view('public', 'notification_delivery_metrics', 'safe delivery metrics view exists');
select has_view('public', 'pending_action_metrics', 'safe pending-action metrics view exists');
select has_view('public', 'notification_dispatch_health', 'safe dispatch-health view exists');
select has_view('public', 'notification_failure_metrics', 'safe failure-code metrics view exists');
select columns_are(
  'public',
  'notification_delivery_metrics',
  array['kind','status','delivery_count','last_updated_at'],
  'delivery metrics expose aggregates only'
);
select columns_are(
  'public',
  'pending_action_metrics',
  array['match_id','pending_presence_count'],
  'pending metrics expose no athlete identity'
);
select columns_are(
  'public',
  'notification_dispatch_health',
  array['last_successful_dispatch_at','failed_delivery_count'],
  'dispatch health exposes no payload or provider identifier'
);
select columns_are(
  'public',
  'notification_failure_metrics',
  array['kind','last_error_code','failure_count','last_updated_at'],
  'failure metrics expose only aggregate safe error codes'
);

select throws_ok(
  $$insert into public.notification_events (kind, resource_type, resource_id, deduplication_key, payload)
    values ('DEADLINE_24H', 'match', gen_random_uuid(),
      'presence:1:schedule:2:call:3:deadline-24h', '{"email":"private@example.test"}'::jsonb)$$,
  null,
  null,
  'notification payloads reject private fields'
);
select throws_ok(
  $$insert into public.notification_deliveries (event_id, user_id, status, attempt_count, sent_at)
    values (gen_random_uuid(), gen_random_uuid(), 'FAILED', 0, statement_timestamp())$$,
  null,
  null,
  'failed deliveries cannot carry a sent timestamp'
);

insert into auth.users(id,email) values
  ('00000000-0000-4000-8000-000000017001','reminder-president@example.test'),
  ('00000000-0000-4000-8000-000000017002','reminder-athlete@example.test');
insert into public.profiles(id) values
  ('00000000-0000-4000-8000-000000017001'),
  ('00000000-0000-4000-8000-000000017002');
insert into public.user_roles(user_id,role,assigned_by) values
  ('00000000-0000-4000-8000-000000017001','PRESIDENT','00000000-0000-4000-8000-000000017001'),
  ('00000000-0000-4000-8000-000000017002','ATHLETE','00000000-0000-4000-8000-000000017001');
insert into public.athletes(id,user_id,full_name,shirt_name,shirt_number,primary_position)
values('00000000-0000-4000-8000-000000017101','00000000-0000-4000-8000-000000017002','Atleta Lembrete','Lembrete',97,'Atacante');
insert into public.seasons(id,year,is_active)
values('00000000-0000-4000-8000-000000017201',2099,false);
insert into public.matches(
  id,season_id,opponent_name,match_date,confirmation_deadline,created_by,updated_by
) values (
  '00000000-0000-4000-8000-000000017301',
  '00000000-0000-4000-8000-000000017201',
  'Adversário Futuro',
  '2099-08-31 12:00:00+00',
  '2099-08-30 12:00:00+00',
  '00000000-0000-4000-8000-000000017001',
  '00000000-0000-4000-8000-000000017001'
);
insert into public.match_presences(
  id,match_id,athlete_id,call_status,presence_status,called_at,call_revision
) values (
  '00000000-0000-4000-8000-000000017401',
  '00000000-0000-4000-8000-000000017301',
  '00000000-0000-4000-8000-000000017101',
  'CALLED','PENDING','2099-08-29 11:00:00+00',1
);

select is(
  private.generate_attendance_reminders('2099-08-29 12:05:00+00'),
  1,
  'the 24-hour reminder is generated inside its ten-minute window'
);
select is(
  (select count(*)::integer from public.notification_events where deduplication_key =
    'presence:00000000-0000-4000-8000-000000017401:schedule:1:call:1:deadline-24h'),
  1,
  'the reminder key contains presence, schedule, call revision, and kind'
);
select is(
  private.generate_attendance_reminders('2099-08-29 12:06:00+00'),
  0,
  'overlapping scans do not duplicate reminders'
);
select is(
  private.generate_attendance_reminders('2099-08-29 12:11:00+00'),
  0,
  'a missed reminder window is not delivered late'
);

update public.match_presences
set called_at = '2099-08-30 05:00:00+00', call_revision = 2
where id = '00000000-0000-4000-8000-000000017401';
select is(
  private.generate_attendance_reminders('2099-08-30 06:05:00+00'),
  1,
  'a legitimate re-call receives the reminder applicable to its new revision'
);
select is(
  (select count(*)::integer from public.notification_events where deduplication_key =
    'presence:00000000-0000-4000-8000-000000017401:schedule:1:call:2:deadline-6h'),
  1,
  'the re-call reminder has a distinct deterministic key'
);
select is(
  (select count(*)::integer from public.notification_deliveries where user_id =
    '00000000-0000-4000-8000-000000017002'),
  2,
  'each generated event creates one recipient delivery'
);

update public.notification_deliveries
set status = 'SENT', attempt_count = 1, sent_at = statement_timestamp(),
  last_error_code = null, next_attempt_at = null, updated_at = statement_timestamp();
insert into public.notification_events(
  id,kind,resource_type,resource_id,deduplication_key,payload
) values (
  '00000000-0000-4000-8000-000000017501','NOTICE_PUBLISHED','notice',
  '00000000-0000-4000-8000-000000017601','notice:dispatch:lifecycle',
  '{"title":"Novo aviso","body":"Consulte o mural.","route":"/app/notices"}'::jsonb
);
insert into public.notification_deliveries(id,event_id,user_id)
values(
  '00000000-0000-4000-8000-000000017701',
  '00000000-0000-4000-8000-000000017501',
  '00000000-0000-4000-8000-000000017002'
);

select is(
  (select count(*)::integer from private.claim_notification_deliveries(1)),
  1,
  'one pending delivery is claimed atomically'
);
select is(
  (select status::text from public.notification_deliveries where id = '00000000-0000-4000-8000-000000017701'),
  'PROCESSING',
  'claiming moves the delivery to processing'
);
select lives_ok(
  $$select private.complete_notification_delivery(
    '00000000-0000-4000-8000-000000017701','RETRY','PROVIDER_UNAVAILABLE',statement_timestamp()
  )$$,
  'transient failures can schedule a bounded retry'
);
select is(
  (select status::text from public.notification_deliveries where id = '00000000-0000-4000-8000-000000017701'),
  'FAILED',
  'a retryable delivery records failed state until its next claim'
);
select is(
  (select attempt_count from public.notification_deliveries where id = '00000000-0000-4000-8000-000000017701'),
  1,
  'the first claim records one attempt'
);
select is(
  (select count(*)::integer from private.claim_notification_deliveries(1)),
  1,
  'a due retry can be reclaimed'
);
select lives_ok(
  $$select private.complete_notification_delivery(
    '00000000-0000-4000-8000-000000017701','SENT',null,null
  )$$,
  'a claimed retry can complete successfully'
);
select ok(
  (select status = 'SENT' and attempt_count = 2 and sent_at is not null
    from public.notification_deliveries where id = '00000000-0000-4000-8000-000000017701'),
  'successful retry records its terminal state and timestamp'
);

select * from finish();
rollback;
