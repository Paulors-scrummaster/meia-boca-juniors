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

/**
 * Caixa residual de 1x1px produzida pela técnica `sr-only` (clip-path + width/height de
 * 1px): o elemento é tecnicamente "visível" para o `:visible` do Playwright (não é
 * `display:none`), mas não é um alvo de toque real — só se torna visível e utilizável ao
 * receber foco de teclado (ex.: o link "Pular para o conteúdo"). WCAG 2.5.8 isenta
 * controles assim, que existem apenas para navegação por teclado.
 */
const SR_ONLY_BOX_THRESHOLD = 2;

/** Princípio IV da Constituição: todo alvo interativo visível mede ao menos 44x44px (SC-009). */
async function expectTouchTargets(page: Page) {
  const targets = page.locator(
    'a:visible, button:visible, input:visible, select:visible, textarea:visible',
  );
  for (let index = 0; index < (await targets.count()); index += 1) {
    const box = await targets.nth(index).boundingBox();
    expect(box, `alvo interativo ${index} deve possuir caixa visível`).not.toBeNull();
    if (box!.width <= SR_ONLY_BOX_THRESHOLD && box!.height <= SR_ONLY_BOX_THRESHOLD) continue;
    expect(box!.height, `altura do alvo interativo ${index}`).toBeGreaterThanOrEqual(44);
    expect(box!.width, `largura do alvo interativo ${index}`).toBeGreaterThanOrEqual(44);
  }
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

    await expectTouchTargets(page);
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

    test(`${label} (${path}) mantém alvos de toque ≥ 44x44 (SC-009)`, async ({ page }) => {
      if (role) {
        await mockAuthenticatedSession(page, role, {
          mustChangePassword: path === '/alterar-senha',
          routes: data,
        });
      }
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectTouchTargets(page);
    });
  }
});

/**
 * Regressão: o link "Pular para o conteúdo" combinava `sr-only` com utilitários visíveis
 * incondicionais (`p-3`, `bg-primary`, ...) — com `box-sizing: border-box`, o padding
 * excedia a largura/altura de 1px de `sr-only` e o navegador expandia a caixa para caber
 * o padding, produzindo um alvo fantasma de 24x24 fora da tela mesmo sem foco. Todo
 * estilo visível precisa ficar atrás de `focus:` para que, sem foco, a caixa permaneça
 * verdadeiramente 1x1 (isenta de SC-009 pela exceção de WCAG 2.5.8) e, com foco, o link
 * se torne um alvo real e utilizável.
 */
test.describe('regressões de acessibilidade — link "Pular para o conteúdo"', () => {
  test('permanece oculto sem foco e se torna um alvo utilizável ao receber foco', async ({
    page,
  }) => {
    await mockAuthenticatedSession(page, 'ATHLETE', { routes: { '/rest/v1/athletes': [] } });
    await page.goto('/app/roster');
    await page.waitForLoadState('networkidle');

    const skipLink = page.getByRole('link', { name: 'Ir para o conteúdo' });
    const hiddenBox = await skipLink.boundingBox();
    expect(
      hiddenBox?.width,
      'sem foco, a caixa deve permanecer no tamanho de sr-only',
    ).toBeLessThanOrEqual(2);
    expect(
      hiddenBox?.height,
      'sem foco, a caixa deve permanecer no tamanho de sr-only',
    ).toBeLessThanOrEqual(2);

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
    const focusedBox = await skipLink.boundingBox();
    expect(focusedBox, 'com foco, o link deve expor uma caixa real').not.toBeNull();
    expect(focusedBox!.width, 'largura do link com foco').toBeGreaterThan(2);
    expect(focusedBox!.height, 'altura do link com foco').toBeGreaterThan(2);

    await page.keyboard.press('Enter');
    await expect(page.locator('#conteudo-principal')).toBeFocused();
  });
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
