import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

export type SocialEvent = Database['public']['Tables']['social_events']['Row'];
export type EventPresenceStatus = Database['public']['Enums']['event_presence_status'];

export interface SplitInfo {
  costPerPerson: number | null;
  peopleCount: number;
  splitUnavailable: boolean;
}

export interface Participant {
  athleteId: string;
  guestsCount: number;
  share: number | null;
  shirtName: string;
  status: EventPresenceStatus;
}

export interface SocialEventsService {
  closeEvent(eventId: string): Promise<{ costPerPerson: number; peopleCount: number }>;
  createEvent(input: {
    eventAt: string;
    locationName: string;
    title: string;
    totalCost: number;
  }): Promise<string>;
  getEvent(eventId: string): Promise<SocialEvent | null>;
  getParticipants(eventId: string): Promise<Participant[]>;
  getSplit(eventId: string): Promise<SplitInfo>;
  listEvents(): Promise<SocialEvent[]>;
  setPresence(input: {
    eventId: string;
    guestsCount: number;
    status: EventPresenceStatus;
  }): Promise<void>;
  updateEvent(
    eventId: string,
    input: Partial<{ eventAt: string; locationName: string; title: string; totalCost: number }>,
  ): Promise<void>;
}

export const socialEventKeys = {
  all: ['social-events'] as const,
  detail: (id: string) => ['social-events', 'detail', id] as const,
  list: () => ['social-events', 'list'] as const,
  participants: (id: string) => ['social-events', 'participants', id] as const,
  split: (id: string) => ['social-events', 'split', id] as const,
};

function mapError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String((error as { code: unknown }).code) : '';
  const message = 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message === 'MFA_REQUIRED') return new AppError('MFA_REQUIRED');
  if (message === 'EVENT_CLOSED') return new AppError('CONFLICT');
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  if (['22023', '22P02', '23514', '23505'].includes(code)) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

const key = () => globalThis.crypto.randomUUID();

export function createSocialEventsService(
  client: SupabaseClient<Database> = supabase,
): SocialEventsService {
  async function rpc(fn: Parameters<typeof client.rpc>[0], args: Record<string, unknown>) {
    const { data, error } = await client.rpc(fn, args as never);
    if (error) throw mapError(error);
    return data as Json;
  }

  return {
    async closeEvent(eventId) {
      const data = (await rpc('close_social_event', {
        command_idempotency_key: key(),
        event_uuid: eventId,
      })) as { costPerPerson: number; peopleCount: number };
      return data;
    },
    async createEvent({ eventAt, locationName, title, totalCost }) {
      const data = (await rpc('create_social_event', {
        command_idempotency_key: key(),
        event_at_input: eventAt,
        location_name_input: locationName,
        title_input: title,
        total_cost_input: totalCost,
      })) as { eventId: string };
      return data.eventId;
    },
    async getEvent(eventId) {
      const { data, error } = await client
        .from('social_events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();
      if (error) throw mapError(error);
      return data;
    },
    async getParticipants(eventId) {
      const { data, error } = await client.rpc('social_event_participants', {
        event_uuid: eventId,
      });
      if (error) throw mapError(error);
      return (data ?? []).map((row) => ({
        athleteId: row.athlete_id,
        guestsCount: row.guests_count,
        share: row.share,
        shirtName: row.shirt_name,
        status: row.status,
      }));
    },
    async getSplit(eventId) {
      const { data, error } = await client.rpc('social_event_split', { event_uuid: eventId });
      if (error) throw mapError(error);
      const row = data?.[0];
      return {
        costPerPerson: row?.cost_per_person ?? null,
        peopleCount: row?.people_count ?? 0,
        splitUnavailable: row?.split_unavailable ?? true,
      };
    },
    async listEvents() {
      const { data, error } = await client
        .from('social_events')
        .select('*')
        .order('event_at', { ascending: false });
      if (error) throw mapError(error);
      return data ?? [];
    },
    async setPresence({ eventId, guestsCount, status }) {
      await rpc('set_event_presence', {
        command_idempotency_key: key(),
        event_uuid: eventId,
        guests_count_input: guestsCount,
        status_input: status,
      });
    },
    async updateEvent(eventId, input) {
      await rpc('update_social_event', {
        command_idempotency_key: key(),
        event_at_input: input.eventAt ?? null,
        event_uuid: eventId,
        location_name_input: input.locationName ?? null,
        title_input: input.title ?? null,
        total_cost_input: input.totalCost ?? null,
      });
    },
  };
}
