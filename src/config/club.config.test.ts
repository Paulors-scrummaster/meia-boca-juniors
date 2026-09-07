import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APPROVED_FORMATIONS, clubConfig, SEMANTIC_THEME_TOKENS } from '@/config/club.config';

const themeStylesheet = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/**
 * Lê os valores declarados no bloco `:root` da folha de estilo, que é a fonte de
 * verdade em runtime. `clubConfig.theme` é o espelho White-Label e não é
 * consumido pelo navegador, então nada além deste teste impede que os dois
 * divirjam silenciosamente.
 */
function readRootTokens(): Record<string, string> {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(themeStylesheet)?.[1];
  if (!root) throw new Error('Bloco :root não encontrado em src/index.css');

  const tokens: Record<string, string> = {};
  for (const [, name, value] of root.matchAll(/--([a-z-]+):\s*([^;]+);/g)) {
    if (name && value) tokens[name] = value.trim();
  }
  return tokens;
}

describe('clubConfig', () => {
  it('espelha exatamente as formações aprovadas', () => {
    expect(clubConfig.approvedFormations).toEqual(['4-4-2', '4-3-3', '4-2-3-1', '3-5-2']);
    expect(clubConfig.approvedFormations).toBe(APPROVED_FORMATIONS);
  });

  it('fornece valor para cada token semântico permitido', () => {
    expect(Object.keys(clubConfig.theme).sort()).toEqual([...SEMANTIC_THEME_TOKENS].sort());
  });

  it('mantém o título bicolor da landing idêntico à cadeia original ao concatenar (FR-035, GL-05)', () => {
    const { welcomeTitle, welcomeTitleHighlight, welcomeTitleLead } = clubConfig.institutional;
    expect(`${welcomeTitleLead} ${welcomeTitleHighlight}`).toBe(welcomeTitle);
    expect(welcomeTitle).toBe('Bem-vindo ao Meia Boca Juniors');
  });
});

describe('paridade de tokens entre a folha de estilo e a configuração do clube', () => {
  const rootTokens = readRootTokens();

  it.each([...SEMANTIC_THEME_TOKENS])('declara %s com o mesmo valor nos dois lugares', (token) => {
    expect(rootTokens[token], `--${token} ausente em src/index.css`).toBeDefined();
    expect(rootTokens[token]).toBe(clubConfig.theme[token]);
  });

  it('não declara em src/index.css nenhum token de cor fora do contrato', () => {
    const contractTokens = new Set<string>(SEMANTIC_THEME_TOKENS);
    const declared = Object.keys(rootTokens).filter((name) => name !== 'radius');
    expect(declared.filter((name) => !contractTokens.has(name))).toEqual([]);
  });

  it('mantém o contorno de campo distinto do divisor, exigido por WCAG 1.4.11', () => {
    expect(clubConfig.theme.input).not.toBe(clubConfig.theme.border);
  });
});
