import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  createAuthService,
  type AuthService,
  type InvitationAcceptanceResult,
} from '@/features/auth/api/auth.service';
import { supabase } from '@/shared/adapters/supabase/client';
import { mapToAppError } from '@/shared/lib/app-error';

const invitationIdSchema = z.string().uuid();
const activationSchema = z
  .object({
    confirmation: z.string(),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
  })
  .refine((values) => values.password === values.confirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['confirmation'],
  });

type ActivationForm = z.infer<typeof activationSchema>;

interface AcceptInvitationPageProps {
  service?: AuthService;
}

export function AcceptInvitationPage({
  service = createAuthService(supabase),
}: AcceptInvitationPageProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitationId = searchParams.get('invitationId') ?? '';
  const invitationIsValid = useMemo(
    () => invitationIdSchema.safeParse(invitationId).success,
    [invitationId],
  );
  const [accepted, setAccepted] = useState<InvitationAcceptanceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ActivationForm>({
    defaultValues: { confirmation: '', password: '' },
    resolver: zodResolver(activationSchema),
  });

  if (!invitationIsValid) {
    return (
      <section className="mx-auto max-w-lg rounded-3xl border bg-card p-7" role="alert">
        <h1 className="text-3xl font-black">Convite inválido</h1>
        <p className="mt-3 text-muted-foreground">
          Abra novamente o link completo enviado pelo Presidente. Nenhum dado do clube foi liberado.
        </p>
      </section>
    );
  }

  if (!auth.user) {
    return (
      <section className="mx-auto max-w-lg rounded-3xl border bg-card p-7">
        <h1 className="text-3xl font-black">Confirme o convite</h1>
        <p className="mt-3 text-muted-foreground">
          Primeiro, conclua a confirmação no link de autenticação. Se você já criou sua senha, entre
          para continuar a ativação.
        </p>
        <Link
          className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-bold text-primary-foreground"
          state={{ from: `/convite?invitationId=${invitationId}` }}
          to="/login"
        >
          Entrar para continuar
        </Link>
      </section>
    );
  }

  const submit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      const result = accepted ?? (await service.acceptInvitation(invitationId));
      setAccepted(result);
      await service.changePassword(password);
      await auth.refresh();
      navigate('/app', { replace: true });
    } catch (cause) {
      setError(mapToAppError(cause).message);
    }
  });

  return (
    <section className="mx-auto max-w-lg rounded-3xl border bg-card p-6 shadow-xl sm:p-8">
      <UserCheck aria-hidden="true" className="h-10 w-10 text-primary" />
      <h1 className="mt-4 text-3xl font-black">Ativar sua conta</h1>
      <div className="mt-5 flex gap-3 rounded-2xl bg-secondary/20 p-4">
        <BadgeCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
        <div>
          <p className="font-bold">Identidade de acesso confirmada</p>
          <p className="break-all text-sm text-muted-foreground">{auth.user.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            O servidor ainda confirmará que esta conta pertence ao atleta do convite.
          </p>
        </div>
      </div>

      <form className="mt-6 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
        <label className="block font-semibold">
          Crie sua senha
          <input
            autoComplete="new-password"
            className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 font-normal"
            type="password"
            {...form.register('password')}
          />
          <span className="mt-1 block text-sm text-destructive" role="alert">
            {form.formState.errors.password?.message}
          </span>
        </label>
        <label className="block font-semibold">
          Confirme sua senha
          <input
            autoComplete="new-password"
            className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 font-normal"
            type="password"
            {...form.register('confirmation')}
          />
          <span className="mt-1 block text-sm text-destructive" role="alert">
            {form.formState.errors.confirmation?.message}
          </span>
        </label>
        {accepted ? (
          <p className="text-sm text-muted-foreground">
            Vínculo do atleta confirmado. Concluindo a definição da senha…
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Ativando…' : 'Confirmar e ativar conta'}
        </button>
      </form>
    </section>
  );
}
