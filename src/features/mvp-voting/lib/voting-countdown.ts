export function getVotingCountdown(closesAt: string, now: number): string {
  const remaining = Math.max(0, new Date(closesAt).getTime() - now);
  if (remaining === 0) return 'Votação encerrada';
  const totalMinutes = Math.floor(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}min restantes`;
}
