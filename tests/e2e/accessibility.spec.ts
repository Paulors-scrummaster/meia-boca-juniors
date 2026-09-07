import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { mockAuthenticatedSession } from './support/auth-mock';
import { EXPECTED_ROUTE_COUNT, ROUTE_CATALOG } from './support/route-catalog';

async function expectWcagAa(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe('regressões de acessibilidade', () => {
  test('mantém semântica, contraste e nomes acessíveis nas telas públicas', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegação pública' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Meia Boca Juniors/);
    await expectWcagAa(page);

    await page.getByRole('link', { name: 'Entrar', exact: true }).click();
    await expect(page.getByLabel('E-mail')).toHaveAttribute('autocomplete', 'email');
    await expect(page.getByLabel('Senha')).toHaveAttribute('autocomplete', 'current-password');
    await expectWcagAa(page);
  });

  test('oferece navegação por teclado, foco visível e alvos de toque adequados', async ({
    page,
  }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Início', exact: true })).toBeFocused();
    const focusOutline = await page
      .getByRole('link', { name: 'Início', exact: true })
      .evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(focusOutline).not.toBe('none');

    const targets = page.locator(
      'a:visible, button:visible, input:visible, select:visible, textarea:visible',
    );
    for (let index = 0; index < (await targets.count()); index += 1) {
      const box = await targets.nth(index).boundingBox();
      expect(box, `alvo interativo ${index} deve possuir caixa visível`).not.toBeNull();
      expect(box!.height, `altura do alvo interativo ${index}`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `largura do alvo interativo ${index}`).toBeGreaterThanOrEqual(44);
    }
  });
});

/**
 * Cobertura ampliada (FR-008a): das 2 rotas públicas originais para as 28 rotas do
 * catálogo (GV-01), exercidas com o papel mínimo que as alcança — cada rota uma vez,
 * não com os três papéis (research D-07): auditar toda rota com todo papel geraria 84
 * execuções, a maioria terminando em redirecionamento por guarda, sem ganho de sinal.
 */
test.describe('regressões de acessibilidade — catálogo de rotas', () => {
  test('o catálogo cobre exatamente as 28 rotas esperadas', () => {
    expect(ROUTE_CATALOG).toHaveLength(EXPECTED_ROUTE_COUNT);
  });

  for (const { data, label, path, role } of ROUTE_CATALOG) {
    test(`${label} (${path}) não viola WCAG A/AA`, async ({ page }) => {
      if (role) {
        await mockAuthenticatedSession(page, role, {
          mustChangePassword: path === '/alterar-senha',
          routes: data,
        });
      }
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectWcagAa(page);
    });
  }
});
