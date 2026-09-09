import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Feature 003 · US4 · T088a — orçamento de tamanho dos assets do cartão do atleta.
// Os SVGs são hand-authored (não derivados das JPEGs de referência) e precisam
// ficar leves o bastante para embutir inline sem inchar o bundle.

const ASSET_DIR = path.resolve(process.cwd(), 'src/features/gamification/assets');
const KB = 1024;

const BUDGETS: Record<string, number> = {
  'card-frame.svg': 12 * KB,
  'card-backdrop.svg': 20 * KB,
  'br-flag.svg': 3 * KB,
  'card-photo-placeholder.svg': 3 * KB,
};

describe('assets do cartão do atleta (T088a)', () => {
  it.each(Object.entries(BUDGETS))('%s existe e respeita o orçamento', (file, budget) => {
    const full = path.join(ASSET_DIR, file);
    const size = statSync(full).size;
    expect(size, `${file} tem ${size} bytes, acima do limite de ${budget}`).toBeLessThanOrEqual(
      budget,
    );
  });

  it('não referencia as imagens JPEG de exemplo', () => {
    for (const file of Object.keys(BUDGETS)) {
      const content = readFileSync(path.join(ASSET_DIR, file), 'utf8');
      expect(content).not.toMatch(/\.jpe?g/i);
    }
  });
});
