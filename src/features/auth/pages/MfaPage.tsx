import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

export function MfaPage({ service: providedService }: MfaPageProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  // O default `createAuthService(supabase)` produziria um objeto novo a cada render, e o efeito
  // abaixo depende da identidade dele. Uma única instância vive enquanto o componente viver.
  const [service] = useState<AuthService>(() => providedService ?? createAuthService(supabase));
  // O preparo cria um fator no servidor, então precisa acontecer exatamente uma vez por montagem,
  // mesmo que o efeito seja reexecutado (StrictMode, por exemplo).
  const preparedRef = useRef(false);
  // Rearmado a cada execução do efeito: sob StrictMode a primeira é limpa antes de a promessa
  // resolver, e sem isso o resultado do preparo seria descartado e a tela ficaria carregando.
  const mountedRef = useRef(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<MfaForm>({ defaultValues: { code: '' }, resolver: zodResolver(schema) });

  useEffect(() => {
    mountedRef.current = true;
    const teardown = () => {
      mountedRef.current = false;
    };
    if (preparedRef.current) return teardown;
    preparedRef.current = true;
    void service
      .getMfaFactors()
      .then(async (factors) => {
        if (!mountedRef.current) return;
        const verified = factors.find((factor) => factor.status === 'verified');
        if (verified) {
          setFactorId(verified.factorId);
          return;
        }
        // Um fator pendente guarda um segredo que só existiu na tela que o gerou: reaproveitá-lo
        // deixaria o usuário sem QR Code e sem código válido. Descartamos antes de recomeçar.
        for (const pending of factors) {
          await service.unenrollMfa(pending.factorId);
        }
        const nextEnrollment = await service.enrollMfa('MBJ');
        if (mountedRef.current) {
          setEnrollment(nextEnrollment);
          setFactorId(nextEnrollment.factorId);
        }
      })
      .catch((cause: unknown) => mountedRef.current && setError(mapToAppError(cause).message))
      .finally(() => mountedRef.current && setLoading(false));
    return teardown;
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
          {/*
            Exceção declarada a FR-003f, permitida por FR-003g: um QR Code exige módulos
            escuros sobre fundo claro para ser lido por scanner. Convertê-lo ao tema escuro
            inviabilizaria a inscrição no segundo fator. Escopo estrito a este contêiner.
          */}
          <img
            alt="QR Code para configurar o autenticador"
            className="mx-auto mt-4 h-52 w-52 rounded-xl bg-white p-2"
            data-theme-exception="qr-code"
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
            className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-center text-2xl tracking-[0.35em]"
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
