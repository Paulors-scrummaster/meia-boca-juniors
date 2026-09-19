-- Hotfix: athlete-invitations/index.ts reads public.athlete_invites directly via
-- supabase-js (service_role) in InvitationRepository.findActive(), used by the RESEND
-- operation. Same root cause as 20260915000100: service_role never received SELECT on
-- this table, so "Gerar novo link do convite ativo" always failed in production with
-- "permission denied for table athlete_invites". Apenas leitura; nenhuma mudança em RLS,
-- e anon/authenticated não recebem nada novo.

grant select on table public.athlete_invites to service_role;
