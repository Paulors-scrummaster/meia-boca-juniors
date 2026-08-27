import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createRosterService,
  type AthleteInput,
  type AthleteStatus,
  type RosterService,
} from '@/features/roster/api/roster.service';

const defaultService = createRosterService();

export const rosterKeys = {
  all: ['roster'] as const,
  detail: (athleteId: string) => [...rosterKeys.all, 'detail', athleteId] as const,
  list: () => [...rosterKeys.all, 'list'] as const,
};

export function rosterQueryOptions(service: RosterService = defaultService) {
  return queryOptions({ queryFn: () => service.listAthletes(), queryKey: rosterKeys.list() });
}

export function athleteQueryOptions(athleteId: string, service: RosterService = defaultService) {
  return queryOptions({
    enabled: athleteId.length > 0,
    queryFn: () => service.getAthlete(athleteId),
    queryKey: rosterKeys.detail(athleteId),
  });
}

export function useRoster(service: RosterService = defaultService) {
  return useQuery(rosterQueryOptions(service));
}

export function useAthlete(athleteId: string, service: RosterService = defaultService) {
  return useQuery(athleteQueryOptions(athleteId, service));
}

export function useRosterMutations(service: RosterService = defaultService) {
  const queryClient = useQueryClient();
  const refresh = async () => queryClient.invalidateQueries({ queryKey: rosterKeys.all });

  return {
    anonymize: useMutation({
      mutationFn: (athleteId: string) => service.anonymizeAthlete(athleteId),
      onSuccess: refresh,
    }),
    create: useMutation({
      mutationFn: (input: AthleteInput) => service.createAthlete(input),
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: (input: {
        athleteId: string;
        replacementShirtNumber?: number;
        status: AthleteStatus;
      }) => service.setAthleteStatus(input.athleteId, input.status, input.replacementShirtNumber),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (input: { athleteId: string; data: Omit<AthleteInput, 'status'> }) =>
        service.updateAthlete(input.athleteId, input.data),
      onSuccess: refresh,
    }),
  };
}
