import { z } from 'zod';

function isHttpUrl(value: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const publicEnvSchema = z.object({
  VITE_APP_ENV: z.enum(['development', 'test', 'staging', 'production']),
  VITE_CLUB_DEPLOYMENT_ID: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  VITE_SUPABASE_URL: z.string().url().refine(isHttpUrl),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(16),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, unknown>): PublicEnv {
  const result = publicEnvSchema.safeParse(source);

  if (!result.success) {
    throw new Error('A configuração pública da aplicação é inválida.');
  }

  return result.data;
}

export const env = parsePublicEnv(import.meta.env);
