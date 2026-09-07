import { expect, test } from '@playwright/test';

import { mockAuthenticatedSession } from './support/auth-mock';
import { buildAllowedColors, findPaletteViolations, readThemeTokens } from './support/palette';
import { PUBLIC_ROUTES } from './support/route-catalog';

/**
 * Camada 2 do portão (contracts/theme-verification.md): conformidade de paleta em
 * runtime. Cobre nesta fase apenas as rotas públicas e de fluxo de autenticação —
 * a ampliação para as 28 rotas do catálogo ocorre em T090, depois que a User Story 4
 * sanear as superfícies de conteúdo (tasks.md, nota de dependência).
 *
 * O contêiner do QR Code em `/mfa` é a única exceção declarada (FR-003g): exigido
 * por requisito funcional de leitura por scanner, marcado com
 * `data-theme-exception="qr-code"`.
 */

const QR_CODE_EXEMPTION = '[data-theme-exception="qr-code"]';

test.describe('conformidade de paleta — rotas públicas e de fluxo de autenticação', () => {
  for (const { label, path, role } of PUBLIC_ROUTES) {
    test(`${label} (${path}) não usa cor fora dos tokens do tema`, async ({ page }) => {
      if (role) {
        await mockAuthenticatedSession(page, role, {
          mustChangePassword: path === '/alterar-senha',
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
