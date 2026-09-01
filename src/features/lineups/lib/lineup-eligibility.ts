import type { LineupAthlete, PresenceByAthlete } from '@/features/lineups/api/lineups.service';

export function getLineupEligibilityMessage(
  athlete: LineupAthlete,
  presenceStatus: PresenceByAthlete[string] | undefined,
): string | null {
  const prefix = `Não é possível incluir ${athlete.full_name}`;
  if (athlete.status === 'INJURED') return `${prefix}: motivo de inelegibilidade — lesão.`;
  if (athlete.status === 'SUSPENDED') return `${prefix}: motivo de inelegibilidade — suspensão.`;
  if (athlete.status === 'INACTIVE') return `${prefix}: motivo de inelegibilidade — inatividade.`;
  if (presenceStatus === 'DECLINED') return `${prefix}: presença recusada nesta partida.`;
  return null;
}
