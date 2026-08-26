import { expect, test } from '@playwright/test';

test('exibe a identidade inicial do clube', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Bem-vindo ao Meia Boca Juniors' })).toBeVisible();
  await expect(page.getByAltText('Escudo do MBJ')).toBeVisible();
});
