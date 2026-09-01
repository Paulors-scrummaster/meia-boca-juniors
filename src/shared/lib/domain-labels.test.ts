import { describe, expect, it } from 'vitest';

import { domainLabels, getDomainLabel } from '@/shared/lib/domain-labels';

describe('domainLabels', () => {
  it('centraliza rótulos portugueses para os estados fundamentais', () => {
    expect(domainLabels.appRole.PRESIDENT).toBe('Presidente');
    expect(domainLabels.athleteStatus.INJURED).toBe('Lesionado');
    expect(domainLabels.notificationStatus.PROCESSING).toBe('Processando');
    expect(domainLabels.notificationKind.LINEUP_PUBLISHED).toBe('Escalação publicada');
  });

  it('mantém a associação tipada por domínio', () => {
    expect(getDomainLabel('presenceStatus', 'DECLINED')).toBe('Recusado');
  });
});
