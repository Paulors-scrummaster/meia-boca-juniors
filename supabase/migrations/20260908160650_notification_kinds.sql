-- Feature 003 · US4 (UX & Gamificação) · T085 (pré-requisito)
-- Novos tipos de notificação para os destaques. Em migração própria para que o
-- `ALTER TYPE ADD VALUE` seja commitado antes de qualquer função (T085) que
-- referencie os valores no corpo.

alter type public.notification_kind add value if not exists 'WEEKLY_HIGHLIGHTS';
alter type public.notification_kind add value if not exists 'PRE_MATCH_HIGHLIGHTS';
