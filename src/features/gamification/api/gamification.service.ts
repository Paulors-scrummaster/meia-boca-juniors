// Feature 003 · US4 (UX & Gamificação) · T088
// Camada de acesso do módulo de gamificação: cartão do atleta, Raio-X, retrospecto
// do clube, galeria de troféus, progresso por troféu, edição de atributos e o
// ciclo de vida de temporada (open/close).

import type { SupabaseClient } from '@supabase/supabase-js';

import { isConnectivityFailure } from '@/shared/hooks/use-connectivity';
import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database } from '@/shared/types/database.generated';

export type Season = Database['public']['Tables']['seasons']['Row'];
export type TrophyScope = Database['public']['Enums']['trophy_scope'];

export interface AthleteCard {
  athleteId: string;
  defending: number | null;
  dribbling: number | null;
  incomplete: boolean;
  overall: number | null;
  pace: number | null;
  passing: number | null;
  photoPath: string | null;
  physical: number | null;
  primaryPosition: string;
  shirtName: string;
  shirtNumber: number;
  shooting: number | null;
}

export interface HeadToHead {
  draws: number;
  goalDiff: number;
  hasHistory: boolean;
  losses: number;
  matchesPlayed: number;
  wins: number;
}

export interface ClubRecord {
  draws: number;
  goalDiff: number;
  goalsAgainst: number;
  goalsFor: number;
  losses: number;
  matchesPlayed: number;
  wins: number;
}

export interface TrophyGalleryEntry {
  athleteId: string;
  awardedAt: string;
  seasonId: string;
  seasonYear: number;
  shirtName: string;
  shirtNumber: number;
  titlePt: string;
  trophyCode: string;
}

export interface TrophyProgress {
  achieved: boolean;
  currentValue: number;
  scope: TrophyScope;
  threshold: number;
  titlePt: string;
  trophyCode: string;
}

export interface AttributesInput {
  athleteId: string;
  defending: number | null;
  dribbling: number | null;
  pace: number | null;
  passing: number | null;
  physical: number | null;
  shooting: number | null;
}

export interface AttributesResult {
  overall: number | null;
}

export interface GamificationService {
  closeSeason(input: { endsOn: string; seasonId: string }): Promise<void>;
  getActiveSeason(): Promise<Season | null>;
  getAthleteCard(athleteId: string): Promise<AthleteCard | null>;
  getClubRecord(): Promise<ClubRecord>;
  getHeadToHead(opponentName: string): Promise<HeadToHead>;
  getTrophyProgress(athleteId: string, seasonId: string): Promise<TrophyProgress[]>;
  listAwardedTrophies(): Promise<TrophyGalleryEntry[]>;
  listSeasons(): Promise<Season[]>;
  openSeason(input: { startsOn: string; year: number }): Promise<void>;
  setAttributes(input: AttributesInput): Promise<AttributesResult>;
}

export const gamificationKeys = {
  all: ['gamification'] as const,
  athleteCard: (id: string) => ['gamification', 'card', id] as const,
  clubRecord: () => ['gamification', 'club-record'] as const,
  headToHead: (opponent: string) => ['gamification', 'raio-x', opponent] as const,
  seasons: () => ['gamification', 'seasons'] as const,
  trophies: () => ['gamification', 'trophies'] as const,
  trophyProgress: (id: string, seasonId: string) =>
    ['gamification', 'trophy-progress', id, seasonId] as const,
};

const EMPTY_HEAD_TO_HEAD: HeadToHead = {
  draws: 0,
  goalDiff: 0,
  hasHistory: false,
  losses: 0,
  matchesPlayed: 0,
  wins: 0,
};

export function mapGamificationError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isConnectivityFailure(error)) return new AppError('OFFLINE');
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String((error as { code: unknown }).code) : '';
  const message = 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message === 'MFA_REQUIRED') return new AppError('MFA_REQUIRED');
  if (message === 'SEASON_ALREADY_ACTIVE' || message === 'SEASON_NOT_ACTIVE') {
    return new AppError('CONFLICT');
  }
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  if (['22023', '22P02', '23514', '23505'].includes(code)) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

const newKey = () => globalThis.crypto.randomUUID();

export function createGamificationService(
  client: SupabaseClient<Database> = supabase,
): GamificationService {
  // Os tipos gerados marcam os args de RPC como não-nulos mesmo quando o
  // parâmetro SQL aceita `null` (atributos do cartão). O wrapper mantém a
  // checagem de tipo no retorno e só afrouxa a assinatura de entrada.
  async function rpc(fn: Parameters<typeof client.rpc>[0], args: Record<string, unknown>) {
    const { data, error } = await client.rpc(fn, args as never);
    if (error) throw mapGamificationError(error);
    return data;
  }

  return {
    async closeSeason({ endsOn, seasonId }) {
      await rpc('close_season', {
        command_idempotency_key: newKey(),
        ends_on_input: endsOn,
        season_uuid: seasonId,
      });
    },
    async getActiveSeason() {
      const { data, error } = await client
        .from('seasons')
        .select('*')
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (error) throw mapGamificationError(error);
      return data;
    },
    async getAthleteCard(athleteId) {
      const { data, error } = await client.rpc('athlete_card', { athlete_uuid: athleteId });
      if (error) throw mapGamificationError(error);
      const row = data?.[0];
      if (!row) return null;
      return {
        athleteId: row.athlete_id,
        defending: row.defending,
        dribbling: row.dribbling,
        incomplete: row.incomplete,
        overall: row.overall,
        pace: row.pace,
        passing: row.passing,
        photoPath: row.photo_path,
        physical: row.physical,
        primaryPosition: row.primary_position,
        shirtName: row.shirt_name,
        shirtNumber: row.shirt_number,
        shooting: row.shooting,
      };
    },
    async getClubRecord() {
      const { data, error } = await client.from('club_all_time_record').select('*').maybeSingle();
      if (error) throw mapGamificationError(error);
      return {
        draws: data?.draws ?? 0,
        goalDiff: data?.goal_diff ?? 0,
        goalsAgainst: data?.goals_against ?? 0,
        goalsFor: data?.goals_for ?? 0,
        losses: data?.losses ?? 0,
        matchesPlayed: data?.matches_played ?? 0,
        wins: data?.wins ?? 0,
      };
    },
    async getHeadToHead(opponentName) {
      const { data, error } = await client.rpc('head_to_head_record', {
        opponent_name_input: opponentName,
      });
      if (error) throw mapGamificationError(error);
      const row = data?.[0];
      if (!row) return EMPTY_HEAD_TO_HEAD;
      return {
        draws: row.draws,
        goalDiff: row.goal_diff,
        hasHistory: row.has_history,
        losses: row.losses,
        matchesPlayed: row.matches_played,
        wins: row.wins,
      };
    },
    async getTrophyProgress(athleteId, seasonId) {
      const { data, error } = await client.rpc('season_trophy_progress', {
        athlete_uuid: athleteId,
        season_uuid: seasonId,
      });
      if (error) throw mapGamificationError(error);
      return (data ?? []).map((row) => ({
        achieved: row.achieved,
        currentValue: row.current_value,
        scope: row.scope,
        threshold: row.threshold,
        titlePt: row.title_pt,
        trophyCode: row.trophy_code,
      }));
    },
    async listAwardedTrophies() {
      const { data, error } = await client
        .from('athlete_trophies')
        .select(
          'trophy_code, awarded_at, season_id, athlete_id, trophy_catalog(title_pt), seasons(year), athletes(shirt_name, shirt_number)',
        )
        .order('awarded_at', { ascending: false });
      if (error) throw mapGamificationError(error);
      return (data ?? []).map((row) => ({
        athleteId: row.athlete_id,
        awardedAt: row.awarded_at,
        seasonId: row.season_id,
        seasonYear: row.seasons?.year ?? 0,
        shirtName: row.athletes?.shirt_name ?? '—',
        shirtNumber: row.athletes?.shirt_number ?? 0,
        titlePt: row.trophy_catalog?.title_pt ?? row.trophy_code,
        trophyCode: row.trophy_code,
      }));
    },
    async listSeasons() {
      const { data, error } = await client
        .from('seasons')
        .select('*')
        .order('year', { ascending: false });
      if (error) throw mapGamificationError(error);
      return data ?? [];
    },
    async openSeason({ startsOn, year }) {
      await rpc('open_season', {
        command_idempotency_key: newKey(),
        starts_on_input: startsOn,
        year_input: year,
      });
    },
    async setAttributes(input) {
      const data = await rpc('set_athlete_attributes', {
        athlete_uuid: input.athleteId,
        command_idempotency_key: newKey(),
        defending_input: input.defending,
        dribbling_input: input.dribbling,
        pace_input: input.pace,
        passing_input: input.passing,
        physical_input: input.physical,
        shooting_input: input.shooting,
      });
      const payload = data as { overall: number | null } | null;
      return { overall: payload?.overall ?? null };
    },
  };
}
