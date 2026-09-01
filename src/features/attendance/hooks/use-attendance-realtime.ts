import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { attendanceKeys } from '@/features/attendance/api/attendance.service';
import { matchKeys } from '@/features/matches/api/matches.service';
import { supabase } from '@/shared/adapters/supabase/client';

export function useAttendanceRealtime(matchId: string, enabled = true): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !matchId) return;
    const channel = supabase
      .channel(`attendance:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `match_id=eq.${matchId}`,
          schema: 'public',
          table: 'match_presences',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: attendanceKeys.staff(matchId) });
          void queryClient.invalidateQueries({ queryKey: attendanceKeys.roster(matchId) });
          void queryClient.invalidateQueries({ queryKey: attendanceKeys.mine(matchId) });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', filter: `id=eq.${matchId}`, schema: 'public', table: 'matches' },
        () => {
          void queryClient.invalidateQueries({ queryKey: matchKeys.detail(matchId) });
          void queryClient.invalidateQueries({ queryKey: matchKeys.list() });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, matchId, queryClient]);
}
