import { expect, test } from '@playwright/test';

import { mockAuthenticatedSession } from './support/auth-mock';
import {
  buildAllowedColors,
  contrastRatio,
  findPaletteViolations,
  HERO_LUMINANCE_CEILING,
  readGradientStops,
  readThemeTokens,
  worstCaseBackground,
} from './support/palette';
import { EXPECTED_ROUTE_COUNT, ROUTE_CATALOG } from './support/route-catalog';

/**
 * Camada 2 do portão (contracts/theme-verification.md): conformidade de paleta em
 * runtime nas 28 rotas do catálogo (SC-003a), agora que a User Story 4 saneou as
 * superfícies de conteúdo (tasks.md, nota de dependência de T089).
 *
 * O contêiner do QR Code em `/mfa` é a única exceção declarada (FR-003g): exigido
 * por requisito funcional de leitura por scanner, marcado com
 * `data-theme-exception="qr-code"`.
 */

const QR_CODE_EXEMPTION = '[data-theme-exception="qr-code"]';

test.describe('conformidade de paleta — catálogo de rotas (SC-003a)', () => {
  test('o catálogo cobre exatamente as 28 rotas esperadas', () => {
    expect(ROUTE_CATALOG).toHaveLength(EXPECTED_ROUTE_COUNT);
  });

  for (const { data, label, path, role } of ROUTE_CATALOG) {
    test(`${label} (${path}) não usa cor fora dos tokens do tema`, async ({ page }) => {
      if (role) {
        await mockAuthenticatedSession(page, role, {
          mustChangePassword: path === '/alterar-senha',
          routes: data,
        });
      }
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const tokens = await readThemeTokens(page);
      const allowed = buildAllowedColors(tokens);
      const violations = await findPaletteViolations(page, allowed, [QR_CODE_EXEMPTION]);

      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});

/**
 * Camada 2b (contracts/theme-verification.md, FR-041, SC-013, GL-16, GL-18): o axe
 * não avalia contraste sobre `background-image` e devolve *incomplete* — nunca
 * reprova gradiente. Esta camada lê os stops declarados do hero, compõe cada um
 * sobre o navy base e verifica o teto de luminância e o contraste dos textos
 * sobrepostos contra o pior caso resultante.
 */
test.describe('camada 2b — luminância e contraste do hero da Landing Page', () => {
  test('nenhum stop do hero excede a luminância-teto e os textos sobrepostos mantêm 4,5:1', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tokens = await readThemeTokens(page);
    const stops = await readGradientStops(
      page,
      '[data-testid="hero-backdrop"]',
      tokens.background!,
    );
    expect(stops.length, 'o hero deve declarar ao menos um stop de gradiente').toBeGreaterThan(0);

    for (const [index, stop] of stops.entries()) {
      expect(
        stop.luminanceOverBase,
        `stop ${index} do hero excede o teto de luminância de FR-041 (${HERO_LUMINANCE_CEILING})`,
      ).toBeLessThanOrEqual(HERO_LUMINANCE_CEILING);
    }

    const worstCase = worstCaseBackground(tokens.background!, stops);
    const pairs: [string, string][] = [
      ['foreground', 'texto primário'],
      ['muted-foreground', 'texto secundário'],
      ['primary', 'texto dourado'],
    ];
    for (const [tokenName, label] of pairs) {
      const ratio = contrastRatio(worstCase, tokens[tokenName]!);
      test.info().annotations.push({
        type: 'contraste',
        description: `${label} (${tokenName}) sobre o pior caso do hero: ${ratio.toFixed(2)}:1`,
      });
      expect(ratio, `${label} sobre o pior caso do hero deve manter 4,5:1`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});

/**
 * FR-042 / SC-014 / GL-17: pares não textuais sujeitos a 3:1 — limites de controle,
 * indicadores de foco e objetos gráficos informativos. Valores de referência
 * calculados em `spec.md` (seção "Contraste de elementos não textuais").
 */
test.describe('não textual — limites de controle, foco e marcações (FR-042)', () => {
  test('contorno de campo, anel de foco e marcação do campo mantêm 3:1', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const tokens = await readThemeTokens(page);
    const pairs: [string, string, string][] = [
      ['input', 'card', 'contorno de campo sobre superfície de card'],
      ['input', 'background', 'contorno de campo sobre o fundo'],
      ['ring', 'card', 'anel de foco sobre superfície de card'],
      ['ring', 'background', 'anel de foco sobre o fundo'],
      ['pitch-line', 'pitch', 'marcação do campo tático sobre o gramado'],
    ];

    for (const [foregroundToken, backgroundToken, label] of pairs) {
      const ratio = contrastRatio(tokens[foregroundToken]!, tokens[backgroundToken]!);
      test.info().annotations.push({
        type: 'contraste',
        description: `${label} (${foregroundToken} sobre ${backgroundToken}): ${ratio.toFixed(2)}:1`,
      });
      expect(ratio, `${label} deve manter 3:1`).toBeGreaterThanOrEqual(3);
    }
  });
});
