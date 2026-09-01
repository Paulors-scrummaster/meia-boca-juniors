import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { mapToAppError } from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

export type Notice = Database['public']['Tables']['notices']['Row'];
export type NoticeWithAuthor = Notice & { authorName: string };

export interface PublishNoticeInput {
  body: string;
  idempotencyKey?: string;
  title: string;
}

export interface PublishNoticeResult {
  body: string;
  id: string;
  notificationEventId: string;
  publishedAt: string;
  publishedBy: string;
  title: string;
}

export interface NoticesService {
  list(limit?: number): Promise<NoticeWithAuthor[]>;
  publish(input: PublishNoticeInput): Promise<PublishNoticeResult>;
}

export const noticeKeys = {
  all: ['notices'] as const,
  list: () => ['notices', 'list'] as const,
};

function requireObject<T>(data: Json | null, error: unknown): T {
  if (error) throw mapToAppError(error);
  if (!data || Array.isArray(data) || typeof data !== 'object') throw mapToAppError(error);
  return data as T;
}

export function createNoticesService(client: SupabaseClient<Database> = supabase): NoticesService {
  return {
    async list(limit = 50) {
      const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
      const { data, error } = await client
        .from('notices')
        .select('id, title, body, published_by, published_at')
        .order('published_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(boundedLimit);
      if (error) throw mapToAppError(error);
      const notices = data ?? [];
      const authorIds = [...new Set(notices.map((notice) => notice.published_by))];
      if (authorIds.length === 0) return [];

      const { data: authors, error: authorsError } = await client
        .from('athletes')
        .select('user_id, full_name')
        .in('user_id', authorIds);
      if (authorsError) throw mapToAppError(authorsError);
      const authorNames = new Map(
        (authors ?? []).flatMap((author) =>
          author.user_id ? [[author.user_id, author.full_name] as const] : [],
        ),
      );
      return notices.map((notice) => ({
        ...notice,
        authorName: authorNames.get(notice.published_by) ?? 'Membro autorizado',
      }));
    },
    async publish(input) {
      const { data, error } = await client.rpc('publish_notice', {
        body_input: input.body,
        command_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
        title_input: input.title,
      });
      return requireObject<PublishNoticeResult>(data, error);
    },
  };
}
