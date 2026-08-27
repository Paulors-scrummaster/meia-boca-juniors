import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createAuthService, type AuthService } from '@/features/auth/api/auth.service';
import { supabase } from '@/shared/adapters/supabase/client';
import type { Database } from '@/shared/types/database.generated';

type AppRole = Database['public']['Enums']['app_role'];

const defaultService = createAuthService(supabase);

export const roleKeys = {
  all: ['auth', 'roles'] as const,
  effective: (userId: string) => [...roleKeys.all, userId] as const,
};

export function effectiveRolesQueryOptions(userId: string, service: AuthService = defaultService) {
  return queryOptions({
    enabled: userId.length > 0,
    queryFn: () => service.getRoles(userId),
    queryKey: roleKeys.effective(userId),
  });
}

export function useEffectiveRoles(userId: string, service: AuthService = defaultService) {
  return useQuery(effectiveRolesQueryOptions(userId, service));
}

export function useSetRole(userId: string, service: AuthService = defaultService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { assigned: boolean; role: AppRole }) =>
      service.setRole({ ...input, userId }),
    onSuccess: (roles) => queryClient.setQueryData(roleKeys.effective(userId), roles),
  });
}
