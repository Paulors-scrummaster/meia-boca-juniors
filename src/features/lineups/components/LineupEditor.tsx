import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  LineupAthlete,
  LineupDraftInput,
  LineupPlayerInput,
  PresenceByAthlete,
} from '@/features/lineups/api/lineups.service';
import { getLineupEligibilityMessage } from '@/features/lineups/lib/lineup-eligibility';

interface LineupEditorProps {
  athletes: LineupAthlete[];
  onChange: (value: LineupDraftInput) => void;
  presenceByAthlete?: PresenceByAthlete;
  value: LineupDraftInput;
}

function playerName(athletes: LineupAthlete[], athleteId: string): string {
  return athletes.find((athlete) => athlete.id === athleteId)?.shirt_name ?? 'Atleta';
}

export function LineupEditor({
  athletes,
  onChange,
  presenceByAthlete = {},
  value,
}: LineupEditorProps) {
  const draftRef = useRef(value);
  const [selectedAthleteId, setSelectedAthleteId] = useState('');
  const draft = value;

  useEffect(() => {
    draftRef.current = value;
  }, [value]);

  const eligible = useMemo(
    () =>
      athletes.filter(
        (athlete) =>
          !getLineupEligibilityMessage(athlete, presenceByAthlete[athlete.id]) &&
          !draft.players.some((player) => player.athleteId === athlete.id),
      ),
    [athletes, draft.players, presenceByAthlete],
  );

  function commit(transform: (current: LineupDraftInput) => LineupDraftInput) {
    const next = transform(draftRef.current);
    draftRef.current = next;
    onChange(next);
  }

  function add(assignment: 'STARTER' | 'RESERVE') {
    if (!selectedAthleteId) return;
    const player: LineupPlayerInput =
      assignment === 'STARTER'
        ? {
            assignment,
            athleteId: selectedAthleteId,
            displayOrder: draft.players.filter((item) => item.assignment === 'STARTER').length,
            positionX: 50,
            positionY: 50,
            tacticalPosition: `POS-${draft.players.filter((item) => item.assignment === 'STARTER').length + 1}`,
          }
        : {
            assignment,
            athleteId: selectedAthleteId,
            displayOrder: draft.players.filter((item) => item.assignment === 'RESERVE').length,
            positionX: null,
            positionY: null,
            tacticalPosition: null,
          };
    commit((current) => ({ ...current, players: [...current.players, player] }));
    setSelectedAthleteId('');
  }

  function moveStarter(athleteId: string, deltaX: number, deltaY: number) {
    commit((current) => ({
      ...current,
      players: current.players.map((player) =>
        player.athleteId === athleteId && player.assignment === 'STARTER'
          ? {
              ...player,
              positionX: Math.max(0, Math.min(100, player.positionX + deltaX)),
              positionY: Math.max(0, Math.min(100, player.positionY + deltaY)),
            }
          : player,
      ),
    }));
  }

  function reorderReserve(athleteId: string, direction: -1 | 1) {
    commit((current) => {
      const reserves = current.players
        .filter((player) => player.assignment === 'RESERVE')
        .sort((a, b) => a.displayOrder - b.displayOrder);
      const index = reserves.findIndex((player) => player.athleteId === athleteId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= reserves.length) return current;
      [reserves[index], reserves[target]] = [reserves[target]!, reserves[index]!];
      const order = new Map(reserves.map((player, itemIndex) => [player.athleteId, itemIndex]));
      return {
        ...current,
        players: current.players.map((player) =>
          player.assignment === 'RESERVE'
            ? { ...player, displayOrder: order.get(player.athleteId) ?? player.displayOrder }
            : player,
        ),
      };
    });
  }

  const starters = draft.players.filter((player) => player.assignment === 'STARTER');
  const reserves = draft.players
    .filter((player) => player.assignment === 'RESERVE')
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <section className="space-y-5">
      <div className="grid gap-3 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="font-semibold">
          Adicionar atleta elegível
          <select
            className="form-input"
            onChange={(event) => setSelectedAthleteId(event.target.value)}
            value={selectedAthleteId}
          >
            <option value="">Selecione</option>
            {eligible.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.full_name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground"
          onClick={() => add('STARTER')}
          type="button"
        >
          Adicionar titular
        </button>
        <button
          className="min-h-12 rounded-xl border px-4 font-bold text-primary"
          onClick={() => add('RESERVE')}
          type="button"
        >
          Adicionar reserva
        </button>
      </div>

      <div
        aria-label="Editor visual do campo tático"
        className="relative min-h-96 overflow-hidden rounded-[2rem] border-4 border-white/80 bg-emerald-700 shadow-inner"
        onPointerMove={(event) => {
          if (event.buttons !== 1) return;
          const athleteId = event.currentTarget.dataset.dragging;
          if (!athleteId) return;
          const rectangle = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rectangle.left) / rectangle.width) * 100;
          const y = ((event.clientY - rectangle.top) / rectangle.height) * 100;
          commit((current) => ({
            ...current,
            players: current.players.map((player) =>
              player.athleteId === athleteId && player.assignment === 'STARTER'
                ? {
                    ...player,
                    positionX: Math.max(0, Math.min(100, x)),
                    positionY: Math.max(0, Math.min(100, y)),
                  }
                : player,
            ),
          }));
        }}
        onPointerUp={(event) => delete event.currentTarget.dataset.dragging}
      >
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 border-t-2 border-white/70" />
        {starters.map((player) => (
          <button
            aria-label={`Posicionar ${playerName(athletes, player.athleteId)}. Use as setas para mover.`}
            className="absolute min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary px-2 text-xs font-black text-primary-foreground shadow-lg focus:outline-none focus:ring-4 focus:ring-secondary"
            key={player.athleteId}
            onKeyDown={(event) => {
              const delta = event.shiftKey ? 5 : 2;
              if (event.key === 'ArrowRight') moveStarter(player.athleteId, delta, 0);
              else if (event.key === 'ArrowLeft') moveStarter(player.athleteId, -delta, 0);
              else if (event.key === 'ArrowUp') moveStarter(player.athleteId, 0, -delta);
              else if (event.key === 'ArrowDown') moveStarter(player.athleteId, 0, delta);
              else return;
              event.preventDefault();
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              const field = event.currentTarget.parentElement;
              if (field) field.dataset.dragging = player.athleteId;
            }}
            style={{ left: `${player.positionX}%`, top: `${player.positionY}%` }}
            type="button"
          >
            {playerName(athletes, player.athleteId)}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border bg-card p-5" aria-labelledby="reserves-title">
        <h2 className="text-xl font-black" id="reserves-title">
          Reservas
        </h2>
        {reserves.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Nenhum reserva adicionado.</p>
        ) : null}
        <ol className="mt-3 space-y-2">
          {reserves.map((player, index) => (
            <li
              className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3"
              key={player.athleteId}
            >
              <span className="font-semibold">
                {index + 1}. {playerName(athletes, player.athleteId)}
              </span>
              <span className="flex gap-2">
                <button
                  aria-label={`Subir ${playerName(athletes, player.athleteId)}`}
                  className="min-h-11 rounded-lg border px-3"
                  onClick={() => reorderReserve(player.athleteId, -1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Descer ${playerName(athletes, player.athleteId)}`}
                  className="min-h-11 rounded-lg border px-3"
                  onClick={() => reorderReserve(player.athleteId, 1)}
                  type="button"
                >
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}
