import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createSocialEventsService,
  socialEventKeys,
  type EventPresenceStatus,
  type SocialEventsService,
} from '@/features/social-events/api/social-events.service';

const defaultService = createSocialEventsService();

export function useSocialEvents(service: SocialEventsService = defaultService) {
  return useQuery({ queryFn: () => service.listEvents(), queryKey: socialEventKeys.list() });
}

export function useSocialEvent(eventId: string, service: SocialEventsService = defaultService) {
  return useQuery({
    enabled: eventId.length > 0,
    queryFn: () => service.getEvent(eventId),
    queryKey: socialEventKeys.detail(eventId),
  });
}

export function useEventSplit(eventId: string, service: SocialEventsService = defaultService) {
  return useQuery({
    enabled: eventId.length > 0,
    queryFn: () => service.getSplit(eventId),
    queryKey: socialEventKeys.split(eventId),
  });
}

export function useEventParticipants(
  eventId: string,
  service: SocialEventsService = defaultService,
) {
  return useQuery({
    enabled: eventId.length > 0,
    queryFn: () => service.getParticipants(eventId),
    queryKey: socialEventKeys.participants(eventId),
  });
}

function useEventInvalidation(eventId?: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: socialEventKeys.all });
    if (eventId) void queryClient.invalidateQueries({ queryKey: socialEventKeys.detail(eventId) });
  };
}

export function useCreateSocialEvent(service: SocialEventsService = defaultService) {
  const invalidate = useEventInvalidation();
  return useMutation({
    mutationFn: (input: Parameters<SocialEventsService['createEvent']>[0]) =>
      service.createEvent(input),
    onSuccess: invalidate,
  });
}

export function useSetPresence(eventId: string, service: SocialEventsService = defaultService) {
  const invalidate = useEventInvalidation(eventId);
  return useMutation({
    mutationFn: (input: { guestsCount: number; status: EventPresenceStatus }) =>
      service.setPresence({ ...input, eventId }),
    onSuccess: invalidate,
  });
}

export function useCloseEvent(eventId: string, service: SocialEventsService = defaultService) {
  const invalidate = useEventInvalidation(eventId);
  return useMutation({
    mutationFn: () => service.closeEvent(eventId),
    onSuccess: invalidate,
  });
}
