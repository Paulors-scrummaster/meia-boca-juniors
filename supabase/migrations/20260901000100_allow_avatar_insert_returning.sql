create policy athlete_avatars_select_uploading_president_aal2
on storage.objects for select
to authenticated
using (
  bucket_id = 'athlete-avatars'
  and owner_id = auth.uid()::text
  and private.has_role('PRESIDENT')
  and private.current_session_is_aal2()
  and name ~ '^athletes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/avatar\.webp$'
  and exists (
    select 1
    from public.athletes
    where id::text = split_part(storage.objects.name, '/', 2)
  )
);

comment on policy athlete_avatars_select_uploading_president_aal2 on storage.objects is
  'Allows only the AAL2 President who owns a canonical upload to receive its inserted metadata before the athlete row is linked.';
