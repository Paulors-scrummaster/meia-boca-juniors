import { describe, expect, it } from 'vitest';

import { parsePublicEnv } from '@/config/env';

const validEnv = {
  VITE_APP_ENV: 'test',
  VITE_CLUB_DEPLOYMENT_ID: 'mbj-test',
  VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'local-public-key-placeholder',
};

describe('parsePublicEnv', () => {
  it('aceita somente a configuração pública esperada', () => {
    expect(parsePublicEnv(validEnv)).toEqual(validEnv);
  });

  it('não expõe detalhes internos quando a configuração é inválida', () => {
    expect(() => parsePublicEnv({ ...validEnv, VITE_SUPABASE_URL: 'invalid' })).toThrow(
      'A configuração pública da aplicação é inválida.',
    );
  });
});
