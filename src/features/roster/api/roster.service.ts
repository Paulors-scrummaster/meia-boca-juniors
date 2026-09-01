import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database } from '@/shared/types/database.generated';

type AthleteRow = Database['public']['Tables']['athletes']['Row'];
export type AthleteStatus = Database['public']['Enums']['athlete_status'];
export type Athlete = AthleteRow & { avatar_url: string | null };

export interface AthleteInput {
  fullName: string;
  photoPath: string | null;
  primaryPosition: string;
  shirtName: string;
  shirtNumber: number;
  status: AthleteStatus;
}

export interface RosterService {
  anonymizeAthlete(athleteId: string): Promise<Athlete>;
  createAthlete(input: AthleteInput): Promise<Athlete>;
  getAthlete(athleteId: string): Promise<Athlete>;
  listAthletes(): Promise<Athlete[]>;
  removeAvatar(athleteId: string): Promise<void>;
  setAthleteStatus(
    athleteId: string,
    status: AthleteStatus,
    replacementShirtNumber?: number,
  ): Promise<Athlete>;
  updateAthlete(athleteId: string, input: Omit<AthleteInput, 'status'>): Promise<Athlete>;
  uploadAvatar(athleteId: string, file: Blob): Promise<string>;
}

function mapRosterError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String(error.code) : '';
  if (code === '23505') {
    return new AppError('CONFLICT', {
      fieldErrors: { shirtNumber: 'Este número já pertence a outro atleta ativo.' },
    });
  }
  if (code === '23514' || code === '22023' || code === '22P02') {
    return new AppError('VALIDATION_ERROR');
  }
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  return new AppError('INTERNAL_ERROR');
}

function requireData<T>(data: T | null, error: unknown): T {
  if (error) throw mapRosterError(error);
  if (data === null) throw new AppError('NOT_FOUND');
  return data;
}

function withoutAvatar(row: AthleteRow): Athlete {
  return { ...row, avatar_url: null };
}

export function createRosterService(client: SupabaseClient<Database> = supabase): RosterService {
  async function addSignedAvatars(rows: AthleteRow[]): Promise<Athlete[]> {
    const paths = rows.flatMap((row) => (row.photo_path ? [row.photo_path] : []));
    if (paths.length === 0) return rows.map(withoutAvatar);
    const { data, error } = await client.storage
      .from('athlete-avatars')
      .createSignedUrls(paths, 300);
    if (error) return rows.map(withoutAvatar);
    const urls = new Map((data ?? []).map((item) => [item.path, item.signedUrl]));
    return rows.map((row) => ({
      ...row,
      avatar_url: row.photo_path ? (urls.get(row.photo_path) ?? null) : null,
    }));
  }

  async function rpcAthlete<
    Name extends 'anonymize_athlete' | 'create_athlete' | 'set_athlete_status' | 'update_athlete',
  >(name: Name, args: Database['public']['Functions'][Name]['Args']): Promise<Athlete> {
    const { data, error } = await client.rpc(name, args);
    return withoutAvatar(requireData(data as AthleteRow | null, error));
  }

  return {
    async anonymizeAthlete(athleteId) {
      return rpcAthlete('anonymize_athlete', {
        athlete_uuid: athleteId,
        request_trace_id: crypto.randomUUID(),
      });
    },
    async createAthlete(input) {
      return rpcAthlete('create_athlete', {
        full_name_input: input.fullName,
        photo_path_input: input.photoPath as string,
        primary_position_input: input.primaryPosition,
        request_trace_id: crypto.randomUUID(),
        shirt_name_input: input.shirtName,
        shirt_number_input: input.shirtNumber,
        status_input: input.status,
      });
    },
    async getAthlete(athleteId) {
      const { data, error } = await client
        .from('athletes')
        .select('*')
        .eq('id', athleteId)
        .maybeSingle();
      return (await addSignedAvatars([requireData(data, error)]))[0] as Athlete;
    },
    async listAthletes() {
      const { data, error } = await client.from('athletes').select('*').order('shirt_number');
      if (error) throw mapRosterError(error);
      return addSignedAvatars(data ?? []);
    },
    async removeAvatar(athleteId) {
      const path = `athletes/${athleteId}/avatar.webp`;
      const { error } = await client.storage.from('athlete-avatars').remove([path]);
      if (error) throw mapRosterError(error);
    },
    async setAthleteStatus(athleteId, status, replacementShirtNumber) {
      return rpcAthlete('set_athlete_status', {
        athlete_uuid: athleteId,
        replacement_shirt_number: (replacementShirtNumber ?? null) as unknown as number,
        request_trace_id: crypto.randomUUID(),
        target_status: status,
      });
    },
    async updateAthlete(athleteId, input) {
      return rpcAthlete('update_athlete', {
        athlete_uuid: athleteId,
        full_name_input: input.fullName,
        photo_path_input: input.photoPath as string,
        primary_position_input: input.primaryPosition,
        request_trace_id: crypto.randomUUID(),
        shirt_name_input: input.shirtName,
        shirt_number_input: input.shirtNumber,
      });
    },
    async uploadAvatar(athleteId, file) {
      const path = `athletes/${athleteId}/avatar.webp`;
      const { error } = await client.storage.from('athlete-avatars').upload(path, file, {
        cacheControl: '300',
        contentType: 'image/webp',
        upsert: true,
      });
      if (error) throw mapRosterError(error);
      return path;
    },
  };
}
