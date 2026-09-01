import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

export type PresenceStatus = Database['public']['Enums']['presence_status'];

export interface PresenceSummary {
  applicable_deadline: string | null;
  athlete_id: string;
  athlete_name: string;
  call_revision: number;
  call_status: Database['public']['Enums']['call_status'];
  individual_deadline: string | null;
  is_exceptional_call: boolean;
  match_id: string;
  presence_id: string;
  presence_status: PresenceStatus;
  reason: string | null;
  responded_at: string | null;
}

export interface AdminPresenceInput {
  athleteId: string;
  explanation: string;
  matchId: string;
  reason: string | null;
  status: PresenceStatus;
}

export interface AttendanceService {
  adminSetPresence(input: AdminPresenceInput): Promise<PresenceSummary>;
  createExceptionalCall(input: {
    athleteId: string;
    deadline: string;
    matchId: string;
  }): Promise<PresenceSummary>;
  getMyPresence(matchId: string): Promise<PresenceSummary | null>;
  listStaffAttendance(matchId: string): Promise<PresenceSummary[]>;
  respondToCall(input: {
    matchId: string;
    reason: string | null;
    status: 'CONFIRMED' | 'DECLINED';
  }): Promise<PresenceSummary>;
  setMatchCallups(matchId: string, athleteIds: string[]): Promise<void>;
}

export const attendanceKeys = {
  all: ['attendance'] as const,
  mine: (matchId: string) => ['attendance', 'mine', matchId] as const,
  roster: (matchId: string) => ['attendance', 'roster', matchId] as const,
  staff: (matchId: string) => ['attendance', 'staff', matchId] as const,
};

function mapAttendanceError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  if (message === 'DEADLINE_CLOSED') return new AppError('DEADLINE_CLOSED');
  if (message === 'MATCH_LOCKED') return new AppError('MATCH_LOCKED');
  if (message === 'MFA_REQUIRED') return new AppError('MFA_REQUIRED');
  if (message === 'ATHLETE_INELIGIBLE') return new AppError('VALIDATION_ERROR');
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  if (code === '22023' || code === '23514') return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

function rpcPresence(data: Json | null, error: unknown): PresenceSummary {
  if (error) throw mapAttendanceError(error);
  if (!data || Array.isArray(data) || typeof data !== 'object')
    throw new AppError('INTERNAL_ERROR');
  const row = data as Record<string, Json | undefined>;
  return {
    applicable_deadline: (row.applicable_deadline as string | null | undefined) ?? null,
    athlete_id: String(row.athlete_id ?? ''),
    athlete_name: String(row.athlete_name ?? ''),
    call_revision: Number(row.call_revision ?? 0),
    call_status: String(row.call_status ?? 'CALLED') as PresenceSummary['call_status'],
    individual_deadline: (row.individual_deadline as string | null | undefined) ?? null,
    is_exceptional_call: Boolean(row.is_exceptional_call),
    match_id: String(row.match_id ?? ''),
    presence_id: String(row.presence_id ?? row.id ?? ''),
    presence_status: String(row.presence_status ?? 'PENDING') as PresenceStatus,
    reason: (row.reason as string | null | undefined) ?? null,
    responded_at: (row.responded_at as string | null | undefined) ?? null,
  };
}

function fromStaffRow(
  row: Database['public']['Views']['staff_attendance_view']['Row'],
): PresenceSummary {
  if (
    !row.athlete_id ||
    !row.athlete_name ||
    !row.match_id ||
    !row.presence_id ||
    !row.call_status ||
    !row.presence_status
  ) {
    throw new AppError('INTERNAL_ERROR');
  }
  return {
    applicable_deadline: row.applicable_deadline,
    athlete_id: row.athlete_id,
    athlete_name: row.athlete_name,
    call_revision: row.call_revision ?? 0,
    call_status: row.call_status,
    individual_deadline: row.individual_deadline,
    is_exceptional_call: row.is_exceptional_call ?? false,
    match_id: row.match_id,
    presence_id: row.presence_id,
    presence_status: row.presence_status,
    reason: row.reason,
    responded_at: row.responded_at,
  };
}

export function createAttendanceService(
  client: SupabaseClient<Database> = supabase,
): AttendanceService {
  return {
    async adminSetPresence(input) {
      const { data, error } = await client.rpc('admin_set_presence', {
        athlete_uuid: input.athleteId,
        change_explanation: input.explanation,
        command_idempotency_key: crypto.randomUUID(),
        match_uuid: input.matchId,
        refusal_reason: input.reason as unknown as string,
        target_status: input.status,
      });
      return { ...rpcPresence(data, error), athlete_id: input.athleteId, match_id: input.matchId };
    },
    async createExceptionalCall(input) {
      const { data, error } = await client.rpc('create_exceptional_call', {
        athlete_uuid: input.athleteId,
        command_idempotency_key: crypto.randomUUID(),
        individual_deadline_input: input.deadline,
        match_uuid: input.matchId,
      });
      return { ...rpcPresence(data, error), athlete_id: input.athleteId, match_id: input.matchId };
    },
    async getMyPresence(matchId) {
      const { data, error } = await client
        .from('next_match_view')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();
      if (error) throw mapAttendanceError(error);
      if (!data?.presence_id || !data.id || !data.call_status || !data.presence_status) return null;
      return {
        applicable_deadline: data.applicable_deadline,
        athlete_id: '',
        athlete_name: '',
        call_revision: 0,
        call_status: data.call_status,
        individual_deadline: data.individual_deadline,
        is_exceptional_call: data.is_exceptional_call ?? false,
        match_id: data.id,
        presence_id: data.presence_id,
        presence_status: data.presence_status,
        reason: null,
        responded_at: null,
      };
    },
    async listStaffAttendance(matchId) {
      const { data, error } = await client
        .from('staff_attendance_view')
        .select('*')
        .eq('match_id', matchId)
        .order('athlete_name');
      if (error) throw mapAttendanceError(error);
      return (data ?? []).map(fromStaffRow);
    },
    async respondToCall(input) {
      const { data, error } = await client.rpc('respond_to_call', {
        command_idempotency_key: crypto.randomUUID(),
        match_uuid: input.matchId,
        refusal_reason: input.reason as unknown as string,
        target_status: input.status,
      });
      return { ...rpcPresence(data, error), match_id: input.matchId };
    },
    async setMatchCallups(matchId, athleteIds) {
      const { error } = await client.rpc('set_match_callups', {
        called_athlete_ids: athleteIds,
        command_idempotency_key: crypto.randomUUID(),
        match_uuid: matchId,
      });
      if (error) throw mapAttendanceError(error);
    },
  };
}
