import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Clock3, Vote } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  createVotingService,
  votingKeys,
  type VotingCandidate,
  type VotingService,
} from '@/features/mvp-voting/api/voting.service';
import { getVotingCountdown } from '@/features/mvp-voting/lib/voting-countdown';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { mapToAppError } from '@/shared/lib/app-error';

interface MvpVotingPageProps {
  now?: () => number;
  service?: VotingService;
}

export function MvpVotingPage({
  now = () => Date.now(),
  service = createVotingService(),
}: MvpVotingPageProps) {
  const [clock, setClock] = useState(now);
  const [success, setSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const round = useQuery({
    queryFn: () => service.getOpenRound(),
    queryKey: votingKeys.openRound,
  });
  const result = useQuery({
    queryFn: () => service.getLatestResult(),
    queryKey: votingKeys.latestResult,
  });
  const vote = useOnlineMutation({
    mutationFn: (candidate: VotingCandidate) =>
      service.castVote({
        candidateAthleteId: candidate.candidate_athlete_id!,
        votingRoundId: candidate.voting_round_id!,
      }),
    onSuccess: async () => {
      setSuccess('Voto registrado com sucesso.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: votingKeys.openRound }),
        queryClient.invalidateQueries({ queryKey: votingKeys.latestResult }),
      ]);
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(now()), 30_000);
    return () => window.clearInterval(timer);
  }, [now]);

  const candidates = useMemo(
    () =>
      (round.data ?? []).filter(
        (candidate) =>
          candidate.candidate_athlete_id &&
          candidate.candidate_athlete_id !== candidate.voter_athlete_id,
      ),
    [round.data],
  );

  if (round.isPending || result.isPending)
    return <LoadingState label="Carregando votação do Craque do Jogo" />;
  if (round.isError || result.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar a votação"
        message={mapToAppError(round.error ?? result.error).message}
        onRetry={() => {
          void round.refetch();
          void result.refetch();
        }}
      />
    );
  }

  const first = candidates[0];
  const hasVoted = candidates.some((candidate) => candidate.has_voted);
  const countdown = first?.closes_at ? getVotingCountdown(first.closes_at, clock) : null;
  const mutationError = vote.error ? mapToAppError(vote.error).message : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Votação MBJ</p>
        <h1 className="mt-2 text-3xl font-black">Craque do Jogo</h1>
        <p className="mt-2 text-muted-foreground">
          Os candidatos vêm da revisão da escalação vinculada à consolidação oficial.
        </p>
      </header>

      {first ? (
        <section className="rounded-3xl border bg-card p-6">
          <div className="flex items-center gap-3" role="timer">
            <Clock3 aria-hidden="true" className="h-6 w-6 text-primary" />
            <p className="font-black">{countdown}</p>
          </div>
          {hasVoted ? (
            <p className="mt-4 rounded-xl bg-muted p-4 font-semibold" role="status">
              Seu voto nesta rodada já foi registrado.
            </p>
          ) : null}
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {candidates.map((candidate) => (
              <li
                className="rounded-2xl border bg-background p-5"
                key={candidate.candidate_athlete_id}
              >
                <p className="text-lg font-black">{candidate.shirt_name}</p>
                <p className="text-sm text-muted-foreground">
                  Camisa {candidate.shirt_number} ·{' '}
                  {candidate.assignment === 'STARTER' ? 'Titular' : 'Reserva'}
                </p>
                <OnlineActionGuard explanation="Reconecte-se para registrar seu voto.">
                  <button
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
                    disabled={hasVoted || vote.isPending || countdown === 'Votação encerrada'}
                    onClick={() => vote.mutate(candidate)}
                    type="button"
                  >
                    <Vote aria-hidden="true" className="h-5 w-5" /> Votar em {candidate.shirt_name}
                  </button>
                </OnlineActionGuard>
              </li>
            ))}
          </ul>
          {mutationError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {mutationError}
            </p>
          ) : null}
          <p aria-live="polite" className="mt-4 font-semibold">
            {success}
          </p>
        </section>
      ) : (
        <EmptyState
          title="Nenhuma votação aberta"
          description="Uma nova rodada será exibida após a próxima consolidação oficial."
        />
      )}

      {result.data ? (
        <section aria-labelledby="mvp-result-title" className="rounded-3xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <Award aria-hidden="true" className="h-7 w-7 text-primary" />
            <h2 className="text-2xl font-black" id="mvp-result-title">
              Resultado do Craque do Jogo
            </h2>
          </div>
          {result.data.winners.length > 0 ? (
            <p className="mt-4 text-lg font-bold">
              {new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(
                result.data.winners.map((winner) => winner.shirtName),
              )}
            </p>
          ) : (
            <p className="mt-4 text-muted-foreground">A rodada terminou sem votos válidos.</p>
          )}
          <ul className="mt-3 space-y-2" aria-label="Premiados da rodada">
            {result.data.winners.map((winner) => (
              <li key={winner.athleteId}>
                {winner.shirtName}, camisa {winner.shirtNumber}: {winner.voteCount}{' '}
                {winner.voteCount === 1 ? 'voto' : 'votos'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
