import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '@/app/providers/AuthProvider';
import {
  createAuthService,
  type AuthService,
  type MfaEnrollmentResult,
} from '@/features/auth/api/auth.service';
import { supabase } from '@/shared/adapters/supabase/client';
import { LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Informe os 6 números do aplicativo.'),
});
type MfaForm = z.infer<typeof schema>;

interface MfaPageProps {
  service?: AuthService;
}

export function MfaPage({ service = createAuthService(supabase) }: MfaPageProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<MfaForm>({ defaultValues: { code: '' }, resolver: zodResolver(schema) });

  useEffect(() => {
    let active = true;
    void service
      .getMfaFactors()
      .then(async (factors) => {
        if (!active) return;
        const existing = factors.find((factor) => factor.status === 'verified') ?? factors[0];
        if (existing) {
          setFactorId(existing.factorId);
          return;
        }
        const nextEnrollment = await service.enrollMfa('MBJ');
        if (active) {
          setEnrollment(nextEnrollment);
          setFactorId(nextEnrollment.factorId);
        }
      })
      .catch((cause: unknown) => active && setError(mapToAppError(cause).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [service]);

  const submit = form.handleSubmit(async ({ code }) => {
    if (!factorId) return;
    setError(null);
    try {
      await service.challengeMfa(factorId, code);
      await auth.refresh();
      navigate(auth.roles.includes('PRESIDENT') ? '/app/admin' : '/app/staff', { replace: true });
    } catch (cause) {
      setError(mapToAppError(cause).message);
    }
  });

  if (loading) return <LoadingState label="Preparando verificação em duas etapas" />;

  return (
    <section className="mx-auto max-w-lg rounded-3xl border bg-card p-6 shadow-xl sm:p-8">
      <ShieldCheck aria-hidden="true" className="h-10 w-10 text-primary" />
      <h1 className="mt-4 text-3xl font-black">Verificação em duas etapas</h1>
      <p className="mt-2 text-muted-foreground">
        Presidente e Técnico precisam confirmar um código TOTP antes de usar funções
        administrativas.
      </p>

      {enrollment ? (
        <div className="mt-6 rounded-2xl bg-muted p-5 text-center">
          <p className="font-bold">Adicione o MBJ ao seu autenticador</p>
          <img
            alt="QR Code para configurar o autenticador"
            className="mx-auto mt-4 h-52 w-52 rounded-xl bg-white p-2"
            src={enrollment.qrCode}
          />
          <details className="mt-3 text-left text-sm">
            <summary className="cursor-pointer font-semibold">Não consigo ler o QR Code</summary>
            <code className="mt-2 block break-all rounded-lg bg-card p-3">{enrollment.secret}</code>
          </details>
        </div>
      ) : null}

      <form className="mt-6 space-y-4" noValidate onSubmit={(event) => void submit(event)}>
        <label className="block font-semibold">
          Código de 6 números
          <input
            autoComplete="one-time-code"
            className="mt-2 min-h-12 w-full rounded-xl border bg-background px-4 text-center text-2xl tracking-[0.35em]"
            inputMode="numeric"
            maxLength={6}
            {...form.register('code')}
          />
          <span className="mt-1 block text-sm text-destructive" role="alert">
            {form.formState.errors.code?.message}
          </span>
        </label>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="min-h-12 w-full rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
          disabled={!factorId || form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? 'Verificando…' : 'Verificar código'}
        </button>
      </form>
    </section>
  );
}
