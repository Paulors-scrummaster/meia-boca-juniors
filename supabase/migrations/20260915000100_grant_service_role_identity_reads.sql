-- Hotfix: Edge Functions de identidade (athlete-invitations, admin-reset-password,
-- push-identity) usam a service_role via supabase-js para ler `profiles.account_status`
-- e `user_roles.role` em `security.authorize()` (supabase/functions/_shared/security.ts).
-- A service_role bypassa RLS, mas ainda precisa de GRANT explícito no Postgres — nunca
-- recebeu SELECT nessas duas tabelas, então toda ação administrativa que dependesse
-- dessa checagem falhava com "permission denied for table profiles/user_roles".
-- Apenas leitura; nenhuma mudança em RLS, e anon/authenticated não recebem nada novo.

grant select on table public.profiles to service_role;
grant select on table public.user_roles to service_role;
