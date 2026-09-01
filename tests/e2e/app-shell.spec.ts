import { expect, test } from '@playwright/test';

test('exibe a identidade inicial do clube', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  expect(pageErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao Meia Boca Juniors' })).toBeVisible();
  await expect(page.getByAltText('Escudo do MBJ')).toBeVisible();
});
