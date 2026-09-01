/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const headers = readFileSync(resolve(import.meta.dirname, '../../public/_headers'), 'utf8');

describe('Cloudflare security headers', () => {
  it('permite avatares assinados do Supabase sem ampliar as demais fontes de imagem', () => {
    const csp = headers
      .split(/\r?\n/)
      .find((line) => line.trimStart().startsWith('Content-Security-Policy:'));

    expect(csp).toBeDefined();
    expect(csp).toContain("img-src 'self' blob: data: https://*.supabase.co;");
    expect(csp).not.toContain('img-src *');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
