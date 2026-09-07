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

/**
 * SC-003b: a auditoria também roda em largura mobile com a gaveta aberta, cobrindo
 * foco contido e véu — estados que só existem nessa combinação e que o laço acima,
 * em largura padrão e gaveta fechada, não exercita.
 */
test.describe('regressões de acessibilidade — gaveta mobile aberta (SC-003b)', () => {
  test('não viola WCAG A/AA com a gaveta aberta em 360x640', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await mockAuthenticatedSession(page, 'PRESIDENT', {
      roles: ['PRESIDENT', 'ATHLETE'],
      routes: { '/rest/v1/athletes': [] },
    });
    await page.goto('/app/roster');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Abrir menu de navegação' }).click();
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();

    await expectWcagAa(page);
  });

  test('contém o foco dentro da gaveta enquanto aberta', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await mockAuthenticatedSession(page, 'PRESIDENT', {
      roles: ['PRESIDENT', 'ATHLETE'],
      routes: { '/rest/v1/athletes': [] },
    });
    await page.goto('/app/roster');
    await page.waitForLoadState('networkidle');

    const menuButton = page.getByRole('button', { name: 'Abrir menu de navegação' });
    await menuButton.click();
    const drawer = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(drawer).toBeVisible();

    // `showModal()` torna o restante da página inerte: tabular repetidamente a
    // partir de dentro da gaveta nunca deve levar o foco para fora dela.
    for (let index = 0; index < 15; index += 1) {
      await page.keyboard.press('Tab');
      const focusedInsideDrawer = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(active?.closest('dialog[open]'));
      });
      expect(focusedInsideDrawer, `foco após ${index + 1} Tab(s) deve permanecer na gaveta`).toBe(
        true,
      );
    }
  });
});
