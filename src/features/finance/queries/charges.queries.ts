import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createFinanceService,
  financeKeys,
  type FinanceService,
} from '@/features/finance/api/charges.service';

const defaultService = createFinanceService();

export function useFinanceOverview(service: FinanceService = defaultService) {
  return useQuery({
    queryFn: () => service.getOverview(),
    queryKey: financeKeys.overview(),
  });
}

export function useAllCharges(service: FinanceService = defaultService) {
  return useQuery({
    queryFn: () => service.listCharges(),
    queryKey: financeKeys.charges(),
  });
}

export function useAthleteCharges(athleteId: string, service: FinanceService = defaultService) {
  return useQuery({
    enabled: athleteId.length > 0,
    queryFn: () => service.listAthleteCharges(athleteId),
    queryKey: financeKeys.athleteCharges(athleteId),
  });
}

export function useDelinquencyBadge(athleteId: string, service: FinanceService = defaultService) {
  return useQuery({
    enabled: athleteId.length > 0,
    queryFn: () => service.getDelinquencyBadge(athleteId),
    queryKey: [...financeKeys.all, 'badge', athleteId] as const,
  });
}

/** Invalida todas as leituras do módulo financeiro após uma escrita. */
function useFinanceInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: financeKeys.all });
}

export function useRunMonthlyGeneration(service: FinanceService = defaultService) {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (period?: string | null) => service.runMonthlyGeneration(period ?? null),
    onSuccess: invalidate,
  });
}

export function useSetDefaultDuesAmount(service: FinanceService = defaultService) {
  return useMutation({ mutationFn: (amount: number) => service.setDefaultAmount(amount) });
}

export function useSettleCharge(service: FinanceService = defaultService) {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (input: { chargeId: string; reason: string }) => service.settleCharge(input),
    onSuccess: invalidate,
  });
}

export function useReverseSettlement(service: FinanceService = defaultService) {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (input: { chargeId: string; reason: string }) => service.reverseSettlement(input),
    onSuccess: invalidate,
  });
}

export function useCancelCharge(service: FinanceService = defaultService) {
  const invalidate = useFinanceInvalidation();
  return useMutation({
    mutationFn: (input: { chargeId: string; reason: string }) => service.cancelCharge(input),
    onSuccess: invalidate,
  });
}
