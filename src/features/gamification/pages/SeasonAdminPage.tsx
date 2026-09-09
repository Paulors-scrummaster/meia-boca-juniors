// Feature 003 · US4 (UX & Gamificação) · T095
// Painel da comissão técnica: ciclo de vida da temporada. Mostra a temporada
// ativa e permite encerrá-la e abrir a próxima. `open_season` / `close_season`
// exigem COACH/PRESIDENT + AAL2 — a rota já protege; o servidor revalida.

import { useState } from 'react';

import type { GamificationService } from '@/features/gamification/api/gamification.service';
import {
  useActiveSeason,
  useCloseSeason,
  useOpenSeason,
  useSeasons,
} from '@/features/gamification/queries/gamification.queries';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDate } from '@/shared/lib/date-time';

interface SeasonAdminPageProps {
  service?: GamificationService;
}

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export function SeasonAdminPage({ service }: SeasonAdminPageProps) {
  const active = useActiveSeason(service);
  const seasons = useSeasons(service);
  const close = useCloseSeason(service);
  const open = useOpenSeason(service);

  const [endsOn, setEndsOn] = useState(todayInputValue);
  const [startsOn, setStartsOn] = useState(todayInputValue);
  const [year, setYear] = useState(() => new Date().getFullYear() + 1);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (active.isPending) return <LoadingState label="Carregando a temporada" />;
  if (active.isError)
    return (
      <ErrorState
        message={mapToAppError(active.error).message}
        onRetry={() => void active.refetch()}
      />
    );

  const season = active.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black text-foreground">Comissão técnica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestão da temporada. Só uma temporada fica ativa por vez; contadores de troféu e
          estatística contam a partir dela.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Temporada ativa</h2>
        {season ? (
          <>
            <p className="mt-2 text-lg font-black text-foreground">
              {season.year}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                desde {formatSaoPauloDate(season.starts_on)}
              </span>
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block font-semibold">Data de encerramento</span>
                <input
                  className="min-h-11 rounded-lg border border-input bg-background px-3"
                  onChange={(event) => setEndsOn(event.target.value)}
                  type="date"
                  value={endsOn}
                />
              </label>
              <OnlineActionGuard>
                <button
                  className="min-h-11 rounded-lg border border-destructive px-4 font-bold text-destructive disabled:opacity-60"
                  disabled={close.isPending}
                  onClick={() => {
                    setFeedback(null);
                    close.mutate(
                      { endsOn, seasonId: season.id },
                      { onSuccess: () => setFeedback(`Temporada ${season.year} encerrada.`) },
                    );
                  }}
                  type="button"
                >
                  Encerrar temporada
                </button>
              </OnlineActionGuard>
            </div>
            {close.isError ? (
              <p className="mt-2 text-sm text-destructive">{mapToAppError(close.error).message}</p>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="Nenhuma temporada ativa"
            description="Abra a próxima temporada para retomar a contagem de estatísticas e troféus."
          />
        )}
      </section>

      {season ? null : (
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-bold text-foreground">Abrir nova temporada</h2>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Ano</span>
              <input
                className="min-h-11 w-28 rounded-lg border border-input bg-background px-3"
                inputMode="numeric"
                onChange={(event) => setYear(Number(event.target.value))}
                type="number"
                value={year}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Início</span>
              <input
                className="min-h-11 rounded-lg border border-input bg-background px-3"
                onChange={(event) => setStartsOn(event.target.value)}
                type="date"
                value={startsOn}
              />
            </label>
            <OnlineActionGuard>
              <button
                className="min-h-11 rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
                disabled={open.isPending || !Number.isInteger(year) || year < 1000 || year > 9999}
                onClick={() => {
                  setFeedback(null);
                  open.mutate(
                    { startsOn, year },
                    { onSuccess: () => setFeedback(`Temporada ${year} aberta.`) },
                  );
                }}
                type="button"
              >
                Abrir temporada
              </button>
            </OnlineActionGuard>
          </div>
          {open.isError ? (
            <p className="mt-2 text-sm text-destructive">{mapToAppError(open.error).message}</p>
          ) : null}
        </section>
      )}

      {feedback ? <p className="text-sm text-success">{feedback}</p> : null}

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Temporadas</h2>
        {seasons.isPending ? (
          <LoadingState label="Carregando" />
        ) : seasons.isError ? (
          <ErrorState message={mapToAppError(seasons.error).message} />
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {(seasons.data ?? []).map((item) => (
              <li className="flex items-center justify-between py-2 text-sm" key={item.id}>
                <span className="font-semibold text-foreground">{item.year}</span>
                <span className="text-muted-foreground">
                  {item.status === 'ACTIVE'
                    ? `Ativa desde ${formatSaoPauloDate(item.starts_on)}`
                    : `Encerrada${item.ends_on ? ` em ${formatSaoPauloDate(item.ends_on)}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
