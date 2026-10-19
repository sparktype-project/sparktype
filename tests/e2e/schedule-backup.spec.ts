import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { chooseZipPublishing, createFirstPage, createUnprotectedSite, gotoDashboard, uniqueName } from './support';

async function saveFromHeader(page: Page): Promise<void> {
  const saveButton = page.locator('header').first().locator('button:not([aria-label])');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(saveButton.locator('svg.text-green-500')).toBeVisible({ timeout: 15000 });
}

async function publishZip(page: Page, firstPublish: boolean): Promise<JSZip> {
  await page.getByRole('button', { name: 'Publish site' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish site' });
  if (firstPublish) await chooseZipPublishing(dialog);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /^Publish( anyway)?$/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Publish download has no filesystem path');
  await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
  return JSZip.loadAsync(await readFile(path));
}

test('a scheduled page is held back from the ZIP until its schedule is cleared', async ({ page }) => {
  await gotoDashboard(page);
  const siteId = await createUnprotectedSite(page, uniqueName('Schedule'));
  await createFirstPage(page, 'Welcome home');

  await page.getByTitle('New Page').click();
  await page.getByLabel('Page title').fill('Coming soon');
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Coming soon');

  await expect(page.getByText('Goes live the next time you publish after this time.')).toBeVisible();
  await page.getByLabel('Schedule', { exact: true }).fill('2099-01-01T09:00');
  await saveFromHeader(page);
  await expect(page.getByRole('img', { name: /^Scheduled for / })).toBeVisible();

  const held = await publishZip(page, true);
  expect(held.files['index.html']).toBeDefined();
  expect(held.files['coming-soon/index.html']).toBeUndefined();
  expect(held.files['_site/content/coming-soon.md']).toBeUndefined();
  expect(await held.files['sitemap.xml']?.async('string') ?? '').not.toContain('coming-soon');

  await page.goto(`/#/sites/${siteId}/edit/content/coming-soon`);
  await page.getByRole('button', { name: 'Clear schedule' }).click();
  await saveFromHeader(page);
  await expect(page.getByRole('img', { name: /^Scheduled for / })).toBeHidden();

  const released = await publishZip(page, false);
  expect(released.files['coming-soon/index.html']).toBeDefined();
  expect(released.files['_site/content/coming-soon.md']).toBeDefined();
});

test('a backup export updates the Last backed up line', async ({ page }) => {
  const siteTitle = uniqueName('Backup');
  await gotoDashboard(page);
  await createUnprotectedSite(page, siteTitle);
  await createFirstPage(page, 'Welcome home');

  await page.getByTitle('Dashboard').click();
  const siteCard = page.locator('div.border-b').filter({ hasText: siteTitle });
  await expect(siteCard.getByTestId('last-backed-up')).toHaveText('Never backed up');
  await expect(page.getByRole('region', { name: 'Backup reminder' })).toContainText(siteTitle);

  await siteCard.getByRole('button').last().click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export backup' }).click();
  await downloadPromise;

  await expect(siteCard.getByTestId('last-backed-up')).toHaveText('Last backed up today');
  await expect(page.getByRole('region', { name: 'Backup reminder' })).toBeHidden();

  await page.reload();
  await expect(siteCard.getByTestId('last-backed-up')).toHaveText('Last backed up today');
});
