import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createFirstPage, createUnprotectedSite, gotoDashboard, uniqueName } from './support';

test('blocks publishing a site that has no homepage', async ({ page }) => {
  await gotoDashboard(page);
  await createUnprotectedSite(page, uniqueName('Blocked Publish'));

  await page.getByRole('button', { name: 'Publish site' }).click();

  const dialog = page.getByRole('dialog', { name: 'Publish site' });
  await expect(dialog.getByText('The site has no homepage.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
});

test('publishes a ZIP after the checks pass, showing each step and the result', async ({ page }) => {
  await gotoDashboard(page);
  await createUnprotectedSite(page, uniqueName('ZIP Publish'));
  await createFirstPage(page, uniqueName('Welcome'));

  await page.getByRole('button', { name: 'Publish site' }).click();

  const dialog = page.getByRole('dialog', { name: 'Publish site' });
  // A new page has no description, which is a warning: the author may publish anyway.
  await expect(dialog.getByText(/has no description/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Publish anyway' }).click();
  const download = await downloadPromise;

  const steps = dialog.getByRole('list', { name: 'Publishing steps' });
  await expect(steps.locator('li[data-state="done"]')).toHaveCount(3);
  await expect(dialog.getByText('Site bundle generated successfully!')).toBeVisible();

  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const path = await download.path();
  if (!path) throw new Error('Publish download has no filesystem path');
  const zip = await JSZip.loadAsync(await readFile(path));
  expect(Object.keys(zip.files)).toContain('index.html');
});
