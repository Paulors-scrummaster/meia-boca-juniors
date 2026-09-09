-- Feature 003 · US3 (Súmula Live) · T056
-- Enums da súmula ao vivo. Sem lógica — só os tipos que as tabelas T057/T058/T059
-- e os comandos de B6/B7 consomem.

create type public.live_sumula_status as enum ('RECORDING', 'IN_REVIEW', 'FINALIZED', 'CANCELLED');
create type public.live_event_type as enum ('GOAL', 'ASSIST', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION');
create type public.team_side as enum ('MBJ', 'OPPONENT');
create type public.card_type as enum ('YELLOW', 'RED');
