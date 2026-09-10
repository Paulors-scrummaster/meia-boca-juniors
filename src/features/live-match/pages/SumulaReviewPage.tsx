// Feature 003 · US3 (Súmula Live) · T071
// Página de revisão pós-jogo. Fina — a lógica está em `ReviewScreen`; aqui só o
// enquadramento. Reutilizável direto na rota (via `LiveRecordingPage` quando o
// setup está `IN_REVIEW`).

import type { LiveMatchService } from '@/features/live-match/api/live-match.service';
import { ReviewScreen } from '@/features/live-match/components/ReviewScreen';

interface SumulaReviewPageProps {
  canFinalize?: boolean;
  matchId: string;
  pendingCount?: number;
  service?: LiveMatchService | undefined;
}

export function SumulaReviewPage({
  canFinalize = false,
  matchId,
  pendingCount = 0,
  service,
}: SumulaReviewPageProps) {
  return (
    <div className="space-y-4">
      <header className="rounded-2xl border bg-card p-5">
        <h1 className="text-xl font-black text-foreground">Revisão da súmula</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confira gols, cartões, substituições e o goleiro antes de consolidar as estatísticas.
        </p>
      </header>
      <ReviewScreen
        canFinalize={canFinalize}
        matchId={matchId}
        pendingCount={pendingCount}
        service={service}
      />
    </div>
  );
}
