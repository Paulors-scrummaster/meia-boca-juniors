import { describe, expect, it } from 'vitest';

import { APPROVED_FORMATIONS, clubConfig, SEMANTIC_THEME_TOKENS } from '@/config/club.config';

describe('clubConfig', () => {
  it('espelha exatamente as formações aprovadas', () => {
    expect(clubConfig.approvedFormations).toEqual(['4-4-2', '4-3-3', '4-2-3-1', '3-5-2']);
    expect(clubConfig.approvedFormations).toBe(APPROVED_FORMATIONS);
  });

  it('fornece valor para cada token semântico permitido', () => {
    expect(Object.keys(clubConfig.theme).sort()).toEqual([...SEMANTIC_THEME_TOKENS].sort());
  });
});
