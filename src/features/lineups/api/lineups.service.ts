import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { APPROVED_FORMATIONS } from '@/config/club.config';
import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

export type LineupAssignment = Database['public']['Enums']['lineup_assignment'];
export type LineupStatus = Database['public']['Enums']['lineup_status'];
export type AthleteStatus = Database['public']['Enums']['athlete_status'];
export type PresenceStatus = Database['public']['Enums']['presence_status'];
export type AllowedFormation = Database['public']['Tables']['allowed_formations']['Row'];
export type LineupRow = Database['public']['Tables']['lineups']['Row'];

export interface LineupAthlete {
  full_name: string;
  id: string;
  primary_position: string;
  shirt_name: string;
  shirt_number: number;
  status: AthleteStatus;
}

export type PresenceByAthlete = Readonly<Record<string, PresenceStatus | null>>;

const starterSchema = z.object({
  assignment: z.literal('STARTER'),
  athleteId: z.string().uuid(),
  displayOrder: z.number().int().nonnegative(),
  positionX: z.number().min(0).max(100),
  positionY: z.number().min(0).max(100),
  tacticalPosition: z.string().trim().min(1).max(30),
});

const reserveSchema = z.object({
  assignment: z.literal('RESERVE'),
  athleteId: z.string().uuid(),
  displayOrder: z.number().int().nonnegative(),
  positionX: z.null(),
  positionY: z.null(),
  tacticalPosition: z.null(),
});

export const lineupDraftSchema = z
  .object({
    formationCode: z.enum(APPROVED_FORMATIONS),
    matchId: z.string().uuid(),
    players: z.array(z.discriminatedUnion('assignment', [starterSchema, reserveSchema])),
  })
  .superRefine((draft, context) => {
    const athleteIds = new Set<string>();
    const reserveOrders = new Set<number>();
    for (const player of draft.players) {
      if (athleteIds.has(player.athleteId)) {
        context.addIssue({ code: 'custom', message: 'Cada atleta pode aparecer uma única vez.' });
      }
      athleteIds.add(player.athleteId);
      if (player.assignment === 'RESERVE') {
        if (reserveOrders.has(player.displayOrder)) {
          context.addIssue({ code: 'custom', message: 'A ordem dos reservas deve ser única.' });
        }
        reserveOrders.add(player.displayOrder);
      }
    }
  });

export type LineupDraftInput = z.infer<typeof lineupDraftSchema>;
export type LineupPlayerInput = LineupDraftInput['players'][number];

export interface DraftLineupModel extends LineupDraftInput {
  id: string;
  revision: number;
  status: LineupStatus;
}

export interface PublishedLineupPlayer {
  assignment: LineupAssignment;
  athlete_id: string;
  display_order: number;
  position_x: number | null;
  position_y: number | null;
  shirt_name: string;
  shirt_number: number;
  tactical_position: string | null;
}

export interface PublishedLineupModel {
  formation_code: string;
  lineup_id: string;
  match_id: string;
  players: PublishedLineupPlayer[];
  published_at: string;
  revision: number;
}

export interface LineupEditorContext {
  athletes: LineupAthlete[];
  draft: DraftLineupModel | null;
  formations: AllowedFormation[];
  presenceByAthlete: PresenceByAthlete;
  published: PublishedLineupModel | null;
}

export interface PublishLineupResult {
  lineupId: string;
  notificationEventId: string | null;
  publishedAt: string;
  revision: number;
}

export interface LineupsService {
  getEditorContext(matchId: string): Promise<LineupEditorContext>;
  getPublished(matchId: string): Promise<PublishedLineupModel | null>;
  publish(matchId: string, draftId: string): Promise<PublishLineupResult>;
  saveDraft(input: LineupDraftInput, draftId?: string): Promise<DraftLineupModel>;
}

function mapLineupError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  if (message === 'MFA_REQUIRED') return new AppError('MFA_REQUIRED');
  if (message === 'MATCH_LOCKED' || message === 'LINEUP_IMMUTABLE')
    return new AppError('MATCH_LOCKED');
  if (message.startsWith('ATHLETE_INELIGIBLE')) {
    return new AppError('VALIDATION_ERROR', {
      fieldErrors: { players: eligibilityMessageFromServer(message) },
    });
  }
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  if (code === '23505') return new AppError('CONFLICT');
  if (['23514', '22023', '22P02'].includes(code)) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

function eligibilityMessageFromServer(message: string): string {
  if (message.endsWith(':INJURED')) return 'Há atleta lesionado na escalação.';
  if (message.endsWith(':SUSPENDED')) return 'Há atleta suspenso na escalação.';
  if (message.endsWith(':INACTIVE')) return 'Há atleta inativo na escalação.';
  if (message.endsWith(':DECLINED')) return 'Há atleta que recusou presença na escalação.';
  return 'Há atleta sem conta e papel Atleta ativos na escalação.';
}

function requireObject<T>(data: Json | null, error: unknown): T {
  if (error) throw mapLineupError(error);
  if (!data || Array.isArray(data) || typeof data !== 'object')
    throw new AppError('INTERNAL_ERROR');
  return data as T;
}

function rowsToPublished(
  rows: Database['public']['Views']['published_lineup_view']['Row'][] | null,
): PublishedLineupModel | null {
  const first = rows?.[0];
  if (
    !first?.lineup_id ||
    !first.match_id ||
    !first.formation_code ||
    !first.published_at ||
    first.revision === null
  )
    return null;
  const players: PublishedLineupPlayer[] = (rows ?? []).flatMap((row) =>
    row.assignment &&
    row.athlete_id &&
    row.display_order !== null &&
    row.shirt_name &&
    row.shirt_number !== null
      ? [
          {
            assignment: row.assignment,
            athlete_id: row.athlete_id,
            display_order: row.display_order,
            position_x: row.position_x,
            position_y: row.position_y,
            shirt_name: row.shirt_name,
            shirt_number: row.shirt_number,
            tactical_position: row.tactical_position,
          },
        ]
      : [],
  );
  return {
    formation_code: first.formation_code,
    lineup_id: first.lineup_id,
    match_id: first.match_id,
    players,
    published_at: first.published_at,
    revision: first.revision,
  };
}

function rowToDraft(
  row: LineupRow,
  players: Database['public']['Tables']['lineup_players']['Row'][],
): DraftLineupModel {
  return {
    formationCode: row.formation_code as LineupDraftInput['formationCode'],
    id: row.id,
    matchId: row.match_id,
    players: players.map((player) =>
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
    revision: row.revision,
    status: row.status,
  };
}

export function createLineupsService(client: SupabaseClient<Database> = supabase): LineupsService {
  async function getPublished(matchId: string): Promise<PublishedLineupModel | null> {
    const { data, error } = await client
      .from('published_lineup_view')
      .select('*')
      .eq('match_id', matchId)
      .order('display_order');
    if (error) throw mapLineupError(error);
    return rowsToPublished(data);
  }

  return {
    async getEditorContext(matchId) {
      const [formationsResult, athletesResult, presencesResult, draftsResult, published] =
        await Promise.all([
          client
            .from('allowed_formations')
            .select('*')
            .eq('is_active', true)
            .order('display_order'),
          client
            .from('athletes')
            .select('id,full_name,shirt_name,shirt_number,primary_position,status')
            .order('shirt_number'),
          client
            .from('match_presences')
            .select('athlete_id,presence_status')
            .eq('match_id', matchId),
          client
            .from('lineups')
            .select('*')
            .eq('match_id', matchId)
            .eq('status', 'DRAFT')
            .order('revision', { ascending: false })
            .limit(1),
          getPublished(matchId),
        ]);
      const firstError =
        formationsResult.error ??
        athletesResult.error ??
        presencesResult.error ??
        draftsResult.error;
      if (firstError) throw mapLineupError(firstError);
      const draftRow = draftsResult.data?.[0] ?? null;
      let draft: DraftLineupModel | null = null;
      if (draftRow) {
        const playersResult = await client
          .from('lineup_players')
          .select('*')
          .eq('lineup_id', draftRow.id)
          .order('display_order');
        if (playersResult.error) throw mapLineupError(playersResult.error);
        draft = rowToDraft(draftRow, playersResult.data ?? []);
      }
      return {
        athletes: athletesResult.data ?? [],
        draft,
        formations: formationsResult.data ?? [],
        presenceByAthlete: Object.fromEntries(
          (presencesResult.data ?? []).map((presence) => [
            presence.athlete_id,
            presence.presence_status,
          ]),
        ),
        published,
      };
    },
    getPublished,
    async publish(matchId, draftId) {
      const { data, error } = await client.rpc('publish_lineup', {
        command_idempotency_key: crypto.randomUUID(),
        draft_lineup_uuid: draftId,
        match_uuid: matchId,
      });
      return requireObject<PublishLineupResult>(data, error);
    },
    async saveDraft(input, draftId) {
      const parsed = lineupDraftSchema.safeParse(input);
      if (!parsed.success) throw new AppError('VALIDATION_ERROR');
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData.user) throw new AppError('UNAUTHENTICATED');

      let row: LineupRow;
      if (draftId) {
        const result = await client
          .from('lineups')
          .update({ formation_code: parsed.data.formationCode })
          .eq('id', draftId)
          .select('*')
          .single();
        if (result.error) throw mapLineupError(result.error);
        row = result.data;
        const deleted = await client.from('lineup_players').delete().eq('lineup_id', draftId);
        if (deleted.error) throw mapLineupError(deleted.error);
      } else {
        const revisions = await client
          .from('lineups')
          .select('revision')
          .eq('match_id', parsed.data.matchId)
          .order('revision', { ascending: false })
          .limit(1);
        if (revisions.error) throw mapLineupError(revisions.error);
        const revision = (revisions.data?.[0]?.revision ?? 0) + 1;
        const result = await client
          .from('lineups')
          .insert({
            created_by: userData.user.id,
            formation_code: parsed.data.formationCode,
            match_id: parsed.data.matchId,
            revision,
          })
          .select('*')
          .single();
        if (result.error) throw mapLineupError(result.error);
        row = result.data;
      }

      if (parsed.data.players.length > 0) {
        const inserted = await client.from('lineup_players').insert(
          parsed.data.players.map((player) => ({
            assignment: player.assignment,
            athlete_id: player.athleteId,
            display_order: player.displayOrder,
            lineup_id: row.id,
            position_x: player.positionX,
            position_y: player.positionY,
            tactical_position: player.tacticalPosition,
          })),
        );
        if (inserted.error) throw mapLineupError(inserted.error);
      }
      return rowToDraft(
        row,
        parsed.data.players.map((player) => ({
          assignment: player.assignment,
          athlete_id: player.athleteId,
          display_order: player.displayOrder,
          lineup_id: row.id,
          position_x: player.positionX,
          position_y: player.positionY,
          tactical_position: player.tacticalPosition,
        })),
      );
    },
  };
}
