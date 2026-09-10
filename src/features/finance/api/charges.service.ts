import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

export type AthleteCharge = Database['public']['Tables']['athlete_charges']['Row'];
export type FinanceOverviewRow = Database['public']['Views']['finance_overview']['Row'];
export type ChargeType = Database['public']['Enums']['charge_type'];

export interface GenerationResult {
  activeAthletes: number;
  created: number;
  period: string;
  skippedExempt: number;
  skippedExisting: number;
}

export type DelinquencyBadge = 'NONE' | 'PENDING' | 'OVERDUE';

export interface FinanceService {
  adjustAmount(input: { amount: number; chargeId: string; reason: string }): Promise<void>;
  cancelCharge(input: { chargeId: string; reason: string }): Promise<void>;
  getDelinquencyBadge(athleteId: string): Promise<DelinquencyBadge>;
  createManualCharge(input: {
    amount: number;
    athleteId: string;
    dueDate: string;
    type: Exclude<ChargeType, 'MONTHLY_AUTOMATIC'>;
  }): Promise<void>;
  getOverview(): Promise<FinanceOverviewRow[]>;
  grantExemption(input: {
    athleteId: string;
    period: string | null;
    reason: string;
  }): Promise<void>;
  listAthleteCharges(athleteId: string): Promise<AthleteCharge[]>;
  listCharges(): Promise<AthleteCharge[]>;
  reverseSettlement(input: { chargeId: string; reason: string }): Promise<void>;
  runMonthlyGeneration(period?: string | null): Promise<GenerationResult>;
  setDefaultAmount(amount: number): Promise<void>;
  settleCharge(input: { chargeId: string; reason: string }): Promise<void>;
}

export const financeKeys = {
  all: ['finance'] as const,
  athleteCharges: (athleteId: string) => ['finance', 'charges', 'athlete', athleteId] as const,
  charges: () => ['finance', 'charges'] as const,
  overview: () => ['finance', 'overview'] as const,
};

function mapFinanceError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String((error as { code: unknown }).code) : '';
  const message = 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message === 'MFA_REQUIRED') return new AppError('MFA_REQUIRED');
  if (message === 'CHARGE_LOCKED') return new AppError('CONFLICT');
  if (message === 'NO_ACTIVE_SEASON' || message === 'DUES_NOT_CONFIGURED')
    return new AppError('VALIDATION_ERROR');
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  if (['22023', '22P02', '23514', '23505'].includes(code)) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

function key(): string {
  return globalThis.crypto.randomUUID();
}

export function createFinanceService(client: SupabaseClient<Database> = supabase): FinanceService {
  async function rpc(fn: Parameters<typeof client.rpc>[0], args: Record<string, unknown>) {
    const { data, error } = await client.rpc(fn, args as never);
    if (error) throw mapFinanceError(error);
    return data;
  }

  return {
    async adjustAmount({ amount, chargeId, reason }) {
      await rpc('adjust_charge_amount', {
        amount,
        charge_uuid: chargeId,
        command_idempotency_key: key(),
        reason_input: reason,
      });
    },
    async cancelCharge({ chargeId, reason }) {
      await rpc('cancel_charge', {
        charge_uuid: chargeId,
        command_idempotency_key: key(),
        reason_input: reason,
      });
    },
    async createManualCharge({ amount, athleteId, dueDate, type }) {
      await rpc('create_manual_charge', {
        amount,
        athlete_uuid: athleteId,
        command_idempotency_key: key(),
        due_date_input: dueDate,
        type_input: type,
      });
    },
    async getDelinquencyBadge(athleteId) {
      const { data, error } = await client.rpc('athlete_delinquency_badge', {
        athlete_uuid: athleteId,
      });
      if (error) throw mapFinanceError(error);
      return (data ?? 'NONE') as DelinquencyBadge;
    },
    async getOverview() {
      const { data, error } = await client
        .from('finance_overview')
        .select('*')
        .order('shirt_number');
      if (error) throw mapFinanceError(error);
      return data ?? [];
    },
    async grantExemption({ athleteId, period, reason }) {
      await rpc('grant_dues_exemption', {
        athlete_uuid: athleteId,
        command_idempotency_key: key(),
        period_input: period,
        reason_input: reason,
      });
    },
    async listAthleteCharges(athleteId) {
      const { data, error } = await client
        .from('athlete_charges')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('due_date', { ascending: false });
      if (error) throw mapFinanceError(error);
      return data ?? [];
    },
    async listCharges() {
      const { data, error } = await client
        .from('athlete_charges')
        .select('*')
        .order('due_date', { ascending: false });
      if (error) throw mapFinanceError(error);
      return data ?? [];
    },
    async reverseSettlement({ chargeId, reason }) {
      await rpc('reverse_charge_settlement', {
        charge_uuid: chargeId,
        command_idempotency_key: key(),
        reason_input: reason,
      });
    },
    async runMonthlyGeneration(period = null) {
      const data = (await rpc('run_monthly_dues_generation', {
        command_idempotency_key: key(),
        period_input: period,
      })) as Json;
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new AppError('INTERNAL_ERROR');
      return data as unknown as GenerationResult;
    },
    async setDefaultAmount(amount) {
      await rpc('set_default_dues_amount', { amount, command_idempotency_key: key() });
    },
    async settleCharge({ chargeId, reason }) {
      await rpc('settle_charge', {
        charge_uuid: chargeId,
        command_idempotency_key: key(),
        reason_input: reason,
      });
    },
  };
}
