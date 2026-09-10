// Feature 003 · US4 · T094 — galeria de troféus do atleta no perfil.
// Reaproveita `useAwardedTrophies` (todas as temporadas) e filtra pelo atleta no
// cliente — sem nova consulta. Degrada em silêncio.

import type { GamificationService } from '../api/gamification.service';
import { useAwardedTrophies } from '../queries/gamification.queries';
import { formatSaoPauloDate } from '@/shared/lib/date-time';

interface AthleteTrophyGalleryProps {
  athleteId: string;
  service?: GamificationService;
}

export function AthleteTrophyGallery({ athleteId, service }: AthleteTrophyGalleryProps) {
  const trophies = useAwardedTrophies(service);
  const earned = (trophies.data ?? []).filter((t) => t.athleteId === athleteId);

  return (
    <section aria-labelledby="athlete-trophies-title" className="rounded-3xl border bg-card p-6">
      <h2 className="text-xl font-black" id="athlete-trophies-title">
        Troféus conquistados
      </h2>

      {trophies.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Carregando troféus…</p>
      ) : trophies.isError ? (
        <p className="mt-4 text-sm text-muted-foreground">Troféus indisponíveis no momento.</p>
      ) : earned.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nenhum troféu ainda. Eles aparecem aqui assim que os gatilhos de estatística forem
          atingidos.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {earned.map((trophy) => (
            <li
              className="flex items-center justify-between gap-3 py-3 text-sm"
              key={`${trophy.trophyCode}-${trophy.seasonId}`}
            >
              <span className="font-semibold text-foreground">{trophy.titlePt}</span>
              <span className="text-muted-foreground">
                Temporada {trophy.seasonYear} · {formatSaoPauloDate(trophy.awardedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
