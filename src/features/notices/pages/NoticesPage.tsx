import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  createNoticesService,
  noticeKeys,
  type NoticesService,
} from '@/features/notices/api/notices.service';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';

const noticeSchema = z.object({
  body: z.string().trim().min(1, 'Informe o conteúdo do aviso.').max(2_000),
  title: z.string().trim().min(1, 'Informe o título do aviso.').max(100),
});

type NoticeFormValues = z.infer<typeof noticeSchema>;

interface NoticesPageProps {
  canPublish: boolean;
  service?: NoticesService;
}

export function NoticesPage({ canPublish, service = createNoticesService() }: NoticesPageProps) {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState('');
  const notices = useQuery({ queryFn: () => service.list(), queryKey: noticeKeys.list() });
  const form = useForm<NoticeFormValues>({
    defaultValues: { body: '', title: '' },
    resolver: zodResolver(noticeSchema),
  });
  const publish = useOnlineMutation({
    mutationFn: (values: NoticeFormValues) => service.publish(values),
    onSuccess: async () => {
      form.reset();
      setSuccess('Aviso publicado com sucesso.');
      await queryClient.invalidateQueries({ queryKey: noticeKeys.all });
    },
  });

  const orderedNotices = [...(notices.data ?? [])].sort(
    (left, right) =>
      new Date(right.published_at).getTime() - new Date(left.published_at).getTime() ||
      right.id.localeCompare(left.id),
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Comunicação</p>
        <h1 className="mt-2 text-3xl font-black">Mural de avisos</h1>
        <p className="mt-2 text-muted-foreground">
          Comunicados oficiais permanecem disponíveis mesmo sem notificações no dispositivo.
        </p>
      </header>

      {canPublish ? (
        <section aria-labelledby="publish-notice-title" className="rounded-3xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <Megaphone aria-hidden="true" className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-black" id="publish-notice-title">
              Publicar aviso
            </h2>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={form.handleSubmit((values) => {
              setSuccess('');
              publish.mutate(values);
            })}
          >
            <label className="block font-semibold" htmlFor="notice-title">
              Título do aviso
              <input
                className="form-input"
                id="notice-title"
                maxLength={100}
                {...form.register('title')}
              />
            </label>
            {form.formState.errors.title ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.title.message}
              </p>
            ) : null}
            <label className="block font-semibold" htmlFor="notice-body">
              Conteúdo do aviso
              <textarea
                className="form-input min-h-32 py-3"
                id="notice-body"
                maxLength={2_000}
                {...form.register('body')}
              />
            </label>
            {form.formState.errors.body ? (
              <p className="text-sm text-destructive" role="alert">
                {form.formState.errors.body.message}
              </p>
            ) : null}
            <OnlineActionGuard explanation="Reconecte-se para publicar o aviso.">
              <button
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
                disabled={publish.isPending}
                type="submit"
              >
                {publish.isPending ? 'Publicando…' : 'Publicar aviso'}
              </button>
            </OnlineActionGuard>
            {publish.isError ? (
              <p className="text-sm text-destructive" role="alert">
                {mapToAppError(publish.error).message}
              </p>
            ) : null}
            <p aria-live="polite" className="font-semibold" role={success ? 'status' : undefined}>
              {success}
            </p>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="notice-wall-title" className="space-y-4">
        <h2 className="text-2xl font-black" id="notice-wall-title">
          Avisos recentes
        </h2>
        {notices.isPending ? <LoadingState label="Carregando avisos" /> : null}
        {notices.isError ? (
          <ErrorState
            title="Não foi possível carregar os avisos"
            message={mapToAppError(notices.error).message}
            onRetry={() => void notices.refetch()}
          />
        ) : null}
        {!notices.isPending && !notices.isError && orderedNotices.length === 0 ? (
          <EmptyState
            title="Nenhum aviso publicado"
            description="Os próximos comunicados oficiais aparecerão aqui."
          />
        ) : null}
        {orderedNotices.length > 0 ? (
          <ul aria-label="Mural de avisos" className="space-y-4">
            {orderedNotices.map((notice) => (
              <li key={notice.id}>
                <article className="rounded-2xl border bg-card p-5">
                  <h3 className="text-xl font-black">{notice.title}</h3>
                  <p className="mt-3 whitespace-pre-wrap">{notice.body}</p>
                  <p className="mt-4 text-sm text-muted-foreground">
                    Publicado por {notice.authorName} ·{' '}
                    {formatSaoPauloDateTime(notice.published_at)}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
