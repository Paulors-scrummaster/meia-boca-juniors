import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '@/app/providers/AuthProvider';
import { createAuthService, type AuthService } from '@/features/auth/api/auth.service';
import { supabase } from '@/shared/adapters/supabase/client';
import { mapToAppError } from '@/shared/lib/app-error';

const schema = z
  .object({
    confirmation: z.string(),
    password: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres.'),
  })
  .refine((values) => values.password === values.confirmation, {
    message: 'As senhas precisam ser iguais.',
    path: ['confirmation'],
  });

type PasswordForm = z.infer<typeof schema>;

interface ChangePasswordPageProps {
  service?: AuthService;
}

export function ChangePasswordPage({
  service = createAuthService(supabase),
}: ChangePasswordPageProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PasswordForm>({
    defaultValues: { confirmation: '', password: '' },
    resolver: zodResolver(schema),
  });

  const submit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await service.changePassword(password);
      await auth.refresh();
      navigate('/app', { replace: true });
    } catch (cause) {
      setError(mapToAppError(cause).message);
    }
  });

  return (
    <section className="mx-auto max-w-lg rounded-3xl border bg-card p-6 shadow-xl sm:p-8">
      <KeyRound aria-hidden="true" className="h-9 w-9 text-primary" />
      <h1 className="mt-4 text-3xl font-black">Crie uma nova senha</h1>
      <p className="mt-2 text-muted-foreground">
        A senha temporária não pode continuar sendo usada. Esta etapa é obrigatória.
      </p>
      <form className="mt-7 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
        <PasswordField
          error={form.formState.errors.password?.message}
          label="Nova senha"
          registration={form.register('password')}
        />
        <PasswordField
          error={form.formState.errors.confirmation?.message}
          label="Confirme a nova senha"
          registration={form.register('confirmation')}
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          className="min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </section>
  );
}

function PasswordField({
  error,
  label,
  registration,
}: {
  error: string | undefined;
  label: string;
  registration: ReturnType<ReturnType<typeof useForm<PasswordForm>>['register']>;
}) {
  return (
    <label className="block font-semibold">
      {label}
      <input
        aria-invalid={Boolean(error)}
        autoComplete="new-password"
        className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 font-normal"
        type="password"
        {...registration}
      />
      <span className="mt-1 block text-sm text-destructive" role="alert">
        {error}
      </span>
    </label>
  );
}
