import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { createAuthService, type AuthService } from '@/features/auth/api/auth.service';
import { supabase } from '@/shared/adapters/supabase/client';
import { mapToAppError } from '@/shared/lib/app-error';

const schema = z.object({
  email: z.string().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

type LoginForm = z.infer<typeof schema>;

interface LoginPageProps {
  service?: AuthService;
}

export function LoginPage({ service = createAuthService(supabase) }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(schema),
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await service.signInWithPassword(values);
      const from = (location.state as { from?: unknown } | null)?.from;
      navigate(typeof from === 'string' && from.startsWith('/') ? from : '/app', { replace: true });
    } catch (cause) {
      setError(mapToAppError(cause).message);
    }
  });

  return (
    <section className="mx-auto max-w-md rounded-3xl border bg-card p-6 shadow-xl shadow-primary/10 sm:p-8">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <LogIn aria-hidden="true" className="h-6 w-6" />
      </div>
      <h1 className="text-3xl font-black">Entrar no MBJ</h1>
      <p className="mt-2 text-muted-foreground">Use o e-mail vinculado ao seu convite.</p>

      <form className="mt-7 space-y-5" noValidate onSubmit={(event) => void submit(event)}>
        <label className="block font-semibold">
          E-mail
          <input
            aria-invalid={Boolean(form.formState.errors.email)}
            autoComplete="email"
            className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 font-normal"
            type="email"
            {...form.register('email')}
          />
          <span className="mt-1 block text-sm text-destructive" role="alert">
            {form.formState.errors.email?.message}
          </span>
        </label>
        <label className="block font-semibold">
          Senha
          <input
            aria-invalid={Boolean(form.formState.errors.password)}
            autoComplete="current-password"
            className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 font-normal"
            type="password"
            {...form.register('password')}
          />
          <span className="mt-1 block text-sm text-destructive" role="alert">
            {form.formState.errors.password?.message}
          </span>
        </label>

        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <button
          className="min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Esqueceu a senha? Solicite ao Presidente uma redefinição administrativa.
      </p>
    </section>
  );
}
