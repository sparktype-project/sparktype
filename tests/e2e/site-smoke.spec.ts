import { expect, test, type Page } from '@playwright/test';

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

async function gotoDashboard(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'My sites' })).toBeVisible();
}

async function createUnprotectedSite(page: Page, siteTitle: string): Promise<string> {
  await page.getByRole('button', { name: 'Create new site' }).click();
  await expect(page.getByRole('heading', { name: 'Create a New Site' })).toBeVisible();

  await page.getByLabel('Site Title').fill(siteTitle);
  await page.getByLabel('Site Description (Optional)').fill('Playwright smoke test site');
  const editProtectionSwitch = page.locator('#edit-protection');
  await expect(editProtectionSwitch).toHaveAttribute('data-state', 'checked');
  await editProtectionSwitch.evaluate((node) => {
    if (!(node instanceof HTMLElement)) {
      throw new Error('Edit protection switch not found');
    }
    node.click();
  });
  await expect(editProtectionSwitch).toHaveAttribute('data-state', 'unchecked');
  await page.getByRole('button', { name: 'Create Site' }).click();

  await expect(page).toHaveURL(/#\/sites\/.+\/edit$/);
  await expect(page.getByRole('heading', { name: 'Create your first page' })).toBeVisible();

  const match = page.url().match(/#\/sites\/([^/]+)\/edit$/);
  if (!match) {
    throw new Error(`Could not extract site id from URL: ${page.url()}`);
  }

  return match[1];
}

async function createFirstPage(page: Page, pageTitle: string): Promise<void> {
  await page.getByRole('button', { name: 'Create a page' }).click();
  await expect(page.getByRole('heading', { name: 'Create a new page' })).toBeVisible();

  await page.getByLabel('Page title').fill(pageTitle);
  await page.getByRole('button', { name: 'Create page' }).click();

  await expect(page).toHaveURL(/#\/sites\/.+\/edit\/content\/.+$/);
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(pageTitle);
}

test('creates a site, persists it, and exports a backup from the dashboard', async ({ page }) => {
  const siteTitle = uniqueName('Reliability Smoke');

  await gotoDashboard(page);
  await createUnprotectedSite(page, siteTitle);

  await page.getByTitle('Dashboard').click();
  await expect(page).toHaveURL(/#\/?$/);
  await expect(page.getByRole('link', { name: siteTitle })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: siteTitle })).toBeVisible();

  const siteCard = page.locator('div.border-b').filter({ hasText: siteTitle });
  await siteCard.getByRole('button').last().click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export backup' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.zip$/);
});

test('creates the first page and renders it in the viewer', async ({ page }) => {
  const siteTitle = uniqueName('Viewer Smoke');
  const pageTitle = uniqueName('Welcome');

  await gotoDashboard(page);
  await createUnprotectedSite(page, siteTitle);
  await createFirstPage(page, pageTitle);

  await page.getByTitle('View site').click();
  await expect(page).toHaveURL(/#\/sites\/.+\/view$/);
  await expect(page.locator('input.browser-address-bar')).toHaveValue('/');

  const frame = page.frameLocator('iframe[title]');
  await expect(frame.getByText('Start writing your content here.')).toBeVisible();
});

test('opens the TipTap slash menu and inserts a heading block', async ({ page }) => {
  const siteTitle = uniqueName('Editor Smoke');
  const pageTitle = uniqueName('Slash Test');

  await gotoDashboard(page);
  await createUnprotectedSite(page, siteTitle);
  await createFirstPage(page, pageTitle);

  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await expect(editor).toContainText('Start writing your content here.');
  await editor.click();
  await page.keyboard.press(selectAllShortcut);
  await page.keyboard.press('Backspace');
  await page.keyboard.type('/hea');

  await expect(page.getByText('Heading 1')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Slash Heading');

  await expect(page.locator('.ProseMirror h1')).toContainText('Slash Heading');
});
