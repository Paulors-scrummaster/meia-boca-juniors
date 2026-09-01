import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Save, UserRoundX } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  createRosterService,
  type Athlete,
  type AthleteInput,
  type RosterService,
} from '@/features/roster/api/roster.service';
import { optimizeAvatar } from '@/features/roster/lib/optimize-avatar';
import { rosterKeys } from '@/features/roster/queries/roster.queries';
import { ConfirmationDialog } from '@/shared/components/feedback';
import { AppError, mapToAppError } from '@/shared/lib/app-error';

const normalizedText = (minimum: number, maximum: number, message: string) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(minimum, message).max(maximum, `Use no máximo ${maximum} caracteres.`));

const schema = z.object({
  fullName: normalizedText(2, 120, 'Informe o nome completo.'),
  primaryPosition: normalizedText(2, 40, 'Informe a posição principal.'),
  shirtName: normalizedText(1, 40, 'Informe o nome de camisa.'),
  shirtNumber: z.coerce
    .number({ invalid_type_error: 'Informe o número da camisa.' })
    .int('Use um número inteiro.')
    .min(1, 'O número deve estar entre 1 e 99.')
    .max(99, 'O número deve estar entre 1 e 99.'),
  status: z.enum(['ACTIVE', 'INJURED', 'SUSPENDED', 'INACTIVE']),
});

type AthleteFormValues = z.infer<typeof schema>;

interface AthleteFormProps {
  athlete?: Athlete;
  onSaved?: (athlete: Athlete) => void;
  service?: RosterService;
}

export function AthleteForm({
  athlete,
  onSaved,
  service = createRosterService(),
}: AthleteFormProps) {
  const [avatar, setAvatar] = useState<File | null>(null);
  const [confirmation, setConfirmation] = useState<'ANONYMIZE' | 'INACTIVATE' | null>(null);
  const [pendingValues, setPendingValues] = useState<AthleteFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<AthleteFormValues>({
    defaultValues: {
      fullName: athlete?.full_name ?? '',
      primaryPosition: athlete?.primary_position ?? '',
      shirtName: athlete?.shirt_name ?? '',
      shirtNumber: athlete?.shirt_number ?? ('' as unknown as number),
      status: athlete?.status ?? 'ACTIVE',
    },
    resolver: zodResolver(schema),
  });

  async function persist(values: AthleteFormValues) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const input: AthleteInput = {
        fullName: values.fullName,
        photoPath: athlete?.photo_path ?? null,
        primaryPosition: values.primaryPosition,
        shirtName: values.shirtName,
        shirtNumber: values.shirtNumber,
        status: values.status,
      };

      let saved = athlete
        ? await service.updateAthlete(athlete.id, {
            fullName: input.fullName,
            photoPath: input.photoPath,
            primaryPosition: input.primaryPosition,
            shirtName: input.shirtName,
            shirtNumber: input.shirtNumber,
          })
        : await service.createAthlete(input);

      if (avatar) {
        const optimized = await optimizeAvatar(avatar);
        const photoPath = await service.uploadAvatar(saved.id, optimized);
        saved = await service.updateAthlete(saved.id, {
          fullName: input.fullName,
          photoPath,
          primaryPosition: input.primaryPosition,
          shirtName: input.shirtName,
          shirtNumber: input.shirtNumber,
        });
        saved = await service.getAthlete(saved.id);
      }

      if (athlete && values.status !== athlete.status) {
        saved =
          athlete.status === 'INACTIVE' && values.status !== 'INACTIVE'
            ? await service.setAthleteStatus(athlete.id, values.status, values.shirtNumber)
            : await service.setAthleteStatus(athlete.id, values.status);
      }

      setSuccess('Atleta salvo com sucesso.');
      queryClient.setQueryData(rosterKeys.detail(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: rosterKeys.list() });
      onSaved?.(saved);
    } catch (cause) {
      const appError = cause instanceof AppError ? cause : mapToAppError(cause);
      const shirtNumberError = appError.fieldErrors.shirtNumber;
      if (shirtNumberError) form.setError('shirtNumber', { message: shirtNumberError });
      setError(
        cause instanceof Error && !(cause instanceof AppError) ? cause.message : appError.message,
      );
    } finally {
      setBusy(false);
    }
  }

  const submit = form.handleSubmit(async (values) => {
    if (athlete && athlete.status !== 'INACTIVE' && values.status === 'INACTIVE') {
      setPendingValues(values);
      setConfirmation('INACTIVATE');
      return;
    }
    await persist(values);
  });

  async function anonymize() {
    if (!athlete) return;
    setConfirmation(null);
    setBusy(true);
    setError(null);
    try {
      if (athlete.photo_path) await service.removeAvatar(athlete.id);
      const saved = await service.anonymizeAthlete(athlete.id);
      setSuccess('Dados pessoais anonimizados e histórico preservado.');
      queryClient.setQueryData(rosterKeys.detail(saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: rosterKeys.list() });
      onSaved?.(saved);
    } catch (cause) {
      setError(mapToAppError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-lg sm:p-8">
      <h1 className="text-3xl font-black">{athlete ? 'Editar atleta' : 'Cadastrar atleta'}</h1>
      <p className="mt-2 text-muted-foreground">
        Dados esportivos ficam no histórico mesmo após a inativação.
      </p>
      <form
        className="mt-7 grid gap-5 sm:grid-cols-2"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <Field
          error={form.formState.errors.fullName?.message}
          id="athlete-full-name"
          label="Nome completo"
          className="sm:col-span-2"
        >
          <input
            className="form-input"
            id="athlete-full-name"
            autoComplete="name"
            {...form.register('fullName')}
          />
        </Field>
        <Field
          error={form.formState.errors.shirtName?.message}
          id="athlete-shirt-name"
          label="Nome de camisa"
        >
          <input className="form-input" id="athlete-shirt-name" {...form.register('shirtName')} />
        </Field>
        <Field
          error={form.formState.errors.shirtNumber?.message}
          id="athlete-shirt-number"
          label="Número da camisa"
        >
          <input
            className="form-input"
            id="athlete-shirt-number"
            inputMode="numeric"
            type="number"
            {...form.register('shirtNumber')}
          />
        </Field>
        <Field
          error={form.formState.errors.primaryPosition?.message}
          id="athlete-position"
          label="Posição principal"
        >
          <input
            className="form-input"
            id="athlete-position"
            {...form.register('primaryPosition')}
          />
        </Field>
        <Field
          error={form.formState.errors.status?.message}
          id="athlete-status"
          label="Estado esportivo"
        >
          <select className="form-input" id="athlete-status" {...form.register('status')}>
            <option value="ACTIVE">Ativo</option>
            <option value="INJURED">Lesionado</option>
            <option value="SUSPENDED">Suspenso</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </Field>
        <label className="sm:col-span-2">
          <span className="font-semibold">Foto opcional</span>
          <span className="mt-2 flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border bg-background px-4 font-semibold text-primary">
            <ImagePlus aria-hidden="true" className="h-5 w-5" />
            {avatar?.name ?? 'Selecionar JPEG, PNG ou WebP'}
          </span>
          <input
            className="sr-only"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
            type="file"
          />
          <span className="mt-1 block text-sm text-muted-foreground">
            A imagem final será quadrada, WebP, até 1024 px e 1 MB.
          </span>
        </label>

        {error ? (
          <p className="sm:col-span-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <p aria-live="polite" className="sm:col-span-2 text-sm text-foreground">
          {success}
        </p>
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:justify-end">
          {athlete?.status === 'INACTIVE' && !athlete.anonymized_at ? (
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-destructive px-5 font-bold text-destructive"
              disabled={busy}
              onClick={() => setConfirmation('ANONYMIZE')}
              type="button"
            >
              <UserRoundX aria-hidden="true" className="h-5 w-5" /> Anonimizar dados pessoais
            </button>
          ) : null}
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            <Save aria-hidden="true" className="h-5 w-5" /> {busy ? 'Salvando…' : 'Salvar atleta'}
          </button>
        </div>
      </form>

      <ConfirmationDialog
        confirmLabel="Inativar atleta"
        description="O número será liberado e somente o papel Atleta será removido. Presidente e Técnico permanecem ativos."
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          const values = pendingValues;
          setConfirmation(null);
          if (values) void persist(values);
        }}
        open={confirmation === 'INACTIVATE'}
        title="Inativar atleta?"
      />
      <ConfirmationDialog
        confirmLabel="Anonimizar definitivamente"
        description="Nome, vínculo de conta e foto serão removidos. O histórico esportivo continuará associado a um identificador anônimo."
        onCancel={() => setConfirmation(null)}
        onConfirm={() => void anonymize()}
        open={confirmation === 'ANONYMIZE'}
        title="Anonimizar dados pessoais?"
      />
    </section>
  );
}

function Field({
  children,
  className = '',
  error,
  id,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  error: string | undefined;
  id: string;
  label: string;
}) {
  return (
    <div className={`block font-semibold ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      <span className="mt-1 block min-h-5 text-sm text-destructive" role="alert">
        {error}
      </span>
    </div>
  );
}
