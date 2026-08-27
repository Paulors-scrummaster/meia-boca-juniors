import type { Database } from '@/shared/types/database.generated';

type Enums = Database['public']['Enums'];

export const domainLabels = {
  appRole: {
    PRESIDENT: 'Presidente',
    COACH: 'Técnico',
    ATHLETE: 'Atleta',
  } satisfies Record<Enums['app_role'], string>,
  accountStatus: {
    ACTIVE: 'Ativa',
    DISABLED: 'Desativada',
  } satisfies Record<Enums['account_status'], string>,
  athleteStatus: {
    ACTIVE: 'Ativo',
    INJURED: 'Lesionado',
    SUSPENDED: 'Suspenso',
    INACTIVE: 'Inativo',
  } satisfies Record<Enums['athlete_status'], string>,
  matchStatus: {
    SCHEDULED: 'Agendada',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  } satisfies Record<Enums['match_status'], string>,
  callStatus: {
    CALLED: 'Convocado',
    NOT_CALLED: 'Não convocado',
  } satisfies Record<Enums['call_status'], string>,
  presenceStatus: {
    PENDING: 'Pendente',
    CONFIRMED: 'Confirmado',
    DECLINED: 'Recusado',
  } satisfies Record<Enums['presence_status'], string>,
  lineupStatus: {
    DRAFT: 'Rascunho',
    PUBLISHED: 'Publicada',
    SUPERSEDED: 'Substituída',
  } satisfies Record<Enums['lineup_status'], string>,
  lineupAssignment: {
    STARTER: 'Titular',
    RESERVE: 'Reserva',
  } satisfies Record<Enums['lineup_assignment'], string>,
  votingRoundStatus: {
    OPEN: 'Aberta',
    CLOSED: 'Encerrada',
    INVALIDATED: 'Invalidada',
  } satisfies Record<Enums['voting_round_status'], string>,
  notificationStatus: {
    PENDING: 'Pendente',
    PROCESSING: 'Processando',
    SENT: 'Enviada',
    FAILED: 'Falhou',
    SKIPPED: 'Ignorada',
  } satisfies Record<Enums['notification_status'], string>,
  notificationKind: {
    CALL_UP: 'Convocação',
    DEADLINE_24H: 'Prazo em 24 horas',
    DEADLINE_6H: 'Prazo em 6 horas',
    MATCH_CHANGED: 'Partida alterada',
    LINEUP_PUBLISHED: 'Escalação publicada',
    VOTING_OPENED: 'Votação aberta',
    NOTICE_PUBLISHED: 'Aviso publicado',
  } satisfies Record<Enums['notification_kind'], string>,
} as const;

export type DomainLabelGroup = keyof typeof domainLabels;

export function getDomainLabel<Group extends DomainLabelGroup>(
  group: Group,
  value: keyof (typeof domainLabels)[Group],
): string {
  const labels = domainLabels[group] as Record<PropertyKey, string>;
  return labels[value];
}
