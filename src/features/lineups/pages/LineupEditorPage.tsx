import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { type ApprovedFormation } from '@/config/club.config';
import {
  createLineupsService,
  type LineupDraftInput,
  type LineupEditorContext,
  type LineupsService,
} from '@/features/lineups/api/lineups.service';
import { FormationSelector } from '@/features/lineups/components/FormationSelector';
import { LineupEditor } from '@/features/lineups/components/LineupEditor';
import { getLineupEligibilityMessage } from '@/features/lineups/lib/lineup-eligibility';
import { lineupEditorOptions, lineupKeys } from '@/features/lineups/queries/lineups.queries';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

interface LineupEditorPageProps {
  matchId: string;
  service?: LineupsService;
}

function emptyDraft(matchId: string): LineupDraftInput {
  return { formationCode: '4-4-2', matchId, players: [] };
}

function initialDraft(context: LineupEditorContext, matchId: string): LineupDraftInput {
  if (context.draft) return context.draft;
  if (!context.published) return emptyDraft(matchId);
  return {
    formationCode: context.published.formation_code as ApprovedFormation,
    matchId,
    players: context.published.players.map((player) =>
      player.assignment === 'STARTER'
        ? {
            assignment: 'STARTER' as const,
            athleteId: player.athlete_id,
            displayOrder: player.display_order,
            positionX: player.position_x ?? 50,
            positionY: player.position_y ?? 50,
            tacticalPosition: player.tactical_position ?? 'POS',
          }
        : {
            assignment: 'RESERVE' as const,
            athleteId: player.athlete_id,
            displayOrder: player.display_order,
            positionX: null,
            positionY: null,
            tacticalPosition: null,
          },
    ),
  };
}

export function LineupEditorPage({
  matchId,
  service = createLineupsService(),
}: LineupEditorPageProps) {
  const query = useQuery(lineupEditorOptions(matchId, service));
  if (query.isPending) return <LoadingState label="Carregando editor de escalação" />;
  if (query.isError)
    return (
      <ErrorState
        title="Não foi possível carregar a escalação"
        message={mapToAppError(query.error).message}
      />
    );
  return (
    <LineupEditorContent
      context={query.data}
      key={query.data.draft?.id ?? matchId}
      matchId={matchId}
      service={service}
    />
  );
}

function LineupEditorContent({
  context,
  matchId,
  service,
}: {
  context: LineupEditorContext;
  matchId: string;
  service: LineupsService;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LineupDraftInput>(() => initialDraft(context, matchId));
  const [draftId, setDraftId] = useState<string | undefined>(context.draft?.id);
  const [publishedInSession, setPublishedInSession] = useState(false);
  const [feedback, setFeedback] = useState('');

  const eligibilityError = useMemo(() => {
    for (const player of draft.players) {
      const athlete = context.athletes.find((item) => item.id === player.athleteId);
      if (!athlete) return 'Um atleta selecionado não está mais disponível.';
      const message = getLineupEligibilityMessage(athlete, context.presenceByAthlete[athlete.id]);
      if (message) return message;
    }
    return null;
  }, [context.athletes, context.presenceByAthlete, draft.players]);

  const save = useMutation({
    mutationFn: (asNewRevision: boolean) =>
      service.saveDraft(draft, asNewRevision ? undefined : draftId),
    onSuccess: async (saved) => {
      setDraftId(saved.id);
      setPublishedInSession(false);
      setFeedback(draftId ? 'Rascunho atualizado.' : 'Rascunho salvo.');
      await queryClient.invalidateQueries({ queryKey: lineupKeys.editor(matchId) });
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (!draftId) throw new Error('DRAFT_REQUIRED');
      return service.publish(matchId, draftId);
    },
    onSuccess: async () => {
      setFeedback('Escalação oficial publicada.');
      setPublishedInSession(true);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: lineupKeys.editor(matchId) }),
        queryClient.invalidateQueries({ queryKey: lineupKeys.published(matchId) }),
      ]);
    },
  });

  const hasOfficial = Boolean(context.published || publishedInSession);
  const error = save.error ?? publish.error;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
          Comissão técnica
        </p>
        <h1 className="mt-2 text-3xl font-black">Editor da escalação</h1>
        <p className="mt-2 text-muted-foreground">
          Organize titulares e reservas antes de publicar a versão oficial.
        </p>
      </header>

      <FormationSelector
        athletes={context.athletes}
        formation={draft.formationCode}
        onFormationChange={(formationCode) =>
          setDraft((current) => ({ ...current, formationCode }))
        }
        presenceByAthlete={context.presenceByAthlete}
      />
      <LineupEditor
        athletes={context.athletes}
        onChange={setDraft}
        presenceByAthlete={context.presenceByAthlete}
        value={draft}
      />

      <OnlineActionGuard>
        <div className="flex flex-wrap gap-3 rounded-2xl border bg-card p-5">
          {!hasOfficial || (!publishedInSession && draftId) ? (
            <button
              className="min-h-12 rounded-xl border px-5 font-bold text-primary disabled:opacity-60"
              disabled={save.isPending}
              onClick={() => save.mutate(false)}
              type="button"
            >
              Salvar rascunho
            </button>
          ) : null}
          {hasOfficial ? (
            <button
              className="min-h-12 rounded-xl border px-5 font-bold text-primary disabled:opacity-60"
              disabled={save.isPending}
              onClick={() => save.mutate(true)}
              type="button"
            >
              Salvar como nova versão
            </button>
          ) : null}
          <button
            className="min-h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
            disabled={
              !draftId ||
              publishedInSession ||
              publish.isPending ||
              Boolean(eligibilityError) ||
              draft.players.length === 0
            }
            onClick={() => publish.mutate()}
            type="button"
          >
            Publicar escalação oficial
          </button>
        </div>
      </OnlineActionGuard>
      {eligibilityError ? (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {eligibilityError}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {mapToAppError(error).message}
        </p>
      ) : null}
      <p aria-live="polite" className="text-sm font-semibold">
        {feedback}
      </p>
    </div>
  );
}
