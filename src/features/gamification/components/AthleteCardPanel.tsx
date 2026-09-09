// Feature 003 · US4 · T094 — painel do cartão detalhado no perfil do atleta.
// Busca `athlete_card` e renderiza a variante detalhada. Degrada em silêncio
// (nota discreta, sem botão) para não poluir a ficha se o cartão indisponível.

import type { GamificationService } from '../api/gamification.service';
import { useAthleteCard } from '../queries/gamification.queries';
import { AttributeCard } from './AttributeCard';

interface AthleteCardPanelProps {
  athleteId: string;
  avatarUrl?: string | null;
  service?: GamificationService;
}

export function AthleteCardPanel({ athleteId, avatarUrl, service }: AthleteCardPanelProps) {
  const card = useAthleteCard(athleteId, service);

  return (
    <section aria-labelledby="attribute-card-title" className="rounded-3xl border bg-card p-6">
      <h2 className="text-xl font-black" id="attribute-card-title">
        Cartão do atleta
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Atributos definidos pela comissão técnica. O overall é a média dos seis.
      </p>

      {card.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando cartão…</p>
      ) : card.isError || !card.data ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Cartão indisponível no momento.
        </p>
      ) : (
        <div className="mt-4 w-full max-w-xs">
          <AttributeCard
            avatarUrl={avatarUrl ?? null}
            card={card.data}
            variant="detailed"
          />
        </div>
      )}
    </section>
  );
}
