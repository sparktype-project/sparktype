import JSZip from 'jszip';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { chooseZipPublishing, createFirstPage, createUnprotectedSite, gotoDashboard, uniqueName } from './support';

test('exports a ZIP with a 404 page, robots.txt, a sitemap and a redirect stub', async ({ page }) => {
  const pageTitle = uniqueName('SEO Home');

  await gotoDashboard(page);
  const siteId = await createUnprotectedSite(page, uniqueName('SEO'));
  await createFirstPage(page, pageTitle);

  // The sitemap and canonical links need a site address; the redirect target is built from it.
  await page.goto(`/#/sites/${siteId}/settings`);
  await expect(page.getByRole('heading', { name: 'Site details' })).toBeVisible();
  await page.getByLabel('Base URL', { exact: true }).fill('https://user.github.io/repo');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByText('Site settings saved successfully!')).toBeVisible();

  // Describe the page and give it an old address, then save through the header control.
  await page.goto(`/#/sites/${siteId}/edit`);
  await page.getByRole('link', { name: pageTitle }).first().click();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(pageTitle);
  await page.getByLabel('Description').fill('A page about SEO');
  await page.getByLabel('Redirect from').fill('/old/seo-home');
  const saveButton = page.locator('header').first().locator('button:not([aria-label])');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(saveButton.locator('svg.text-green-500')).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: 'Publish site' }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish site' });
  await chooseZipPublishing(dialog);
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: /^Publish( anyway)?$/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('Publish download has no filesystem path');

  const zip = await JSZip.loadAsync(await readFile(path));
  const read = (name: string) => zip.files[name]?.async('string');

  const notFound = await read('404.html');
  expect(notFound).toContain('Page not found');
  expect(notFound).toContain('noindex');
  expect(notFound).toContain('href="/repo/_site/themes/');

  expect(await read('robots.txt')).toBe(
    'User-agent: *\nAllow: /\n\nSitemap: https://user.github.io/repo/sitemap.xml\n',
  );

  const sitemap = await read('sitemap.xml');
  expect(sitemap).toContain('<loc>https://user.github.io/repo/</loc>');
  expect(sitemap).not.toContain('404');

  const stub = await read('old/seo-home/index.html');
  expect(stub).toContain('http-equiv="refresh"');
  expect(stub).toContain('url=https://user.github.io/repo/');
  expect(stub).toContain('<link rel="canonical" href="https://user.github.io/repo/">');
  expect(await read('_redirects')).toBe('/old/seo-home /repo/ 301\n');
});
