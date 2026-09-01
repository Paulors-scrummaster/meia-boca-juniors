import type { PublishedLineupModel } from '@/features/lineups/api/lineups.service';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';

export function PublishedLineup({ lineup }: { lineup: PublishedLineupModel }) {
  const starters = lineup.players.filter((player) => player.assignment === 'STARTER');
  const reserves = lineup.players
    .filter((player) => player.assignment === 'RESERVE')
    .sort((a, b) => a.display_order - b.display_order);

  return (
    <article className="space-y-6">
      <header>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
          Formação {lineup.formation_code}
        </p>
        <h1 className="mt-2 text-3xl font-black">Escalação oficial — versão {lineup.revision}</h1>
        <p className="mt-2 text-muted-foreground">
          Publicada em {formatSaoPauloDateTime(lineup.published_at)}
        </p>
      </header>

      <div
        aria-label="Campo tático da escalação oficial"
        className="relative min-h-96 overflow-hidden rounded-[2rem] border-4 border-white/80 bg-emerald-700 shadow-inner"
      >
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t-2 border-white/70" />
        {starters.map((player) => (
          <div
            className="absolute min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary px-2 py-3 text-center text-xs font-black text-primary-foreground shadow-lg"
            key={player.athlete_id}
            style={{ left: `${player.position_x ?? 50}%`, top: `${player.position_y ?? 50}%` }}
          >
            {player.shirt_number} · {player.shirt_name}
          </div>
        ))}
      </div>

      <section className="sr-only">
        <h2>Representação textual</h2>
        <ul aria-label="Representação textual da escalação">
          {starters.map((player) => (
            <li key={player.athlete_id}>
              Titular: {player.shirt_name}, camisa {player.shirt_number}, posição{' '}
              {player.tactical_position}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-black">Reservas</h2>
        <ol aria-label="Reservas em ordem" className="mt-3 grid gap-2 sm:grid-cols-2">
          {reserves.map((player, index) => (
            <li className="rounded-xl bg-muted p-3 font-semibold" key={player.athlete_id}>
              Reserva {index + 1}: {player.shirt_name}, camisa {player.shirt_number}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
