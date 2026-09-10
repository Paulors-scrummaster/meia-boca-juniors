// Feature 003 · US4 (UX & Gamificação) · T088
// Hooks TanStack para o módulo de gamificação.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createGamificationService,
  gamificationKeys,
  type AttributesInput,
  type GamificationService,
} from '@/features/gamification/api/gamification.service';

const defaultService = createGamificationService();

export function useAthleteCard(athleteId: string, service: GamificationService = defaultService) {
  return useQuery({
    enabled: athleteId.length > 0,
    queryFn: () => service.getAthleteCard(athleteId),
    queryKey: gamificationKeys.athleteCard(athleteId),
  });
}

export function useHeadToHead(opponentName: string, service: GamificationService = defaultService) {
  return useQuery({
    enabled: opponentName.length > 0,
    queryFn: () => service.getHeadToHead(opponentName),
    queryKey: gamificationKeys.headToHead(opponentName),
  });
}

export function useClubRecord(service: GamificationService = defaultService) {
  return useQuery({
    queryFn: () => service.getClubRecord(),
    queryKey: gamificationKeys.clubRecord(),
  });
}

export function useAwardedTrophies(service: GamificationService = defaultService) {
  return useQuery({
    queryFn: () => service.listAwardedTrophies(),
    queryKey: gamificationKeys.trophies(),
  });
}

export function useTrophyProgress(
  athleteId: string,
  seasonId: string,
  service: GamificationService = defaultService,
) {
  return useQuery({
    enabled: athleteId.length > 0 && seasonId.length > 0,
    queryFn: () => service.getTrophyProgress(athleteId, seasonId),
    queryKey: gamificationKeys.trophyProgress(athleteId, seasonId),
  });
}

export function useActiveSeason(service: GamificationService = defaultService) {
  return useQuery({
    queryFn: () => service.getActiveSeason(),
    queryKey: [...gamificationKeys.seasons(), 'active'] as const,
  });
}

export function useSeasons(service: GamificationService = defaultService) {
  return useQuery({
    queryFn: () => service.listSeasons(),
    queryKey: gamificationKeys.seasons(),
  });
}

export function useSetAthleteAttributes(
  athleteId: string,
  service: GamificationService = defaultService,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<AttributesInput, 'athleteId'>) =>
      service.setAttributes({ ...input, athleteId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.athleteCard(athleteId) });
      void queryClient.invalidateQueries({ queryKey: gamificationKeys.all });
    },
  });
}

function useSeasonInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: gamificationKeys.all });
}

export function useOpenSeason(service: GamificationService = defaultService) {
  const invalidate = useSeasonInvalidation();
  return useMutation({
    mutationFn: (input: { startsOn: string; year: number }) => service.openSeason(input),
    onSuccess: invalidate,
  });
}

export function useCloseSeason(service: GamificationService = defaultService) {
  const invalidate = useSeasonInvalidation();
  return useMutation({
    mutationFn: (input: { endsOn: string; seasonId: string }) => service.closeSeason(input),
    onSuccess: invalidate,
  });
}
