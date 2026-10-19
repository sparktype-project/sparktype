import { expect, type Locator, type Page } from '@playwright/test';

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

export async function gotoDashboard(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'My sites' })).toBeVisible();
}

export async function createUnprotectedSite(page: Page, siteTitle: string): Promise<string> {
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

export async function createFirstPage(page: Page, pageTitle: string): Promise<void> {
  await page.getByRole('button', { name: 'Create a page' }).click();
  await expect(page.getByRole('heading', { name: 'Create a new page' })).toBeVisible();

  await page.getByLabel('Page title').fill(pageTitle);
  await page.getByRole('button', { name: 'Create page' }).click();

  await expect(page).toHaveURL(/#\/sites\/.+\/edit\/content\/.+$/);
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(pageTitle);
}

/** First-run publishing setup: a site with no provider asks where to publish; pick ZIP. */
export async function chooseZipPublishing(dialog: Locator): Promise<void> {
  await expect(dialog.getByText('Where do you want to publish?')).toBeVisible();
  await dialog.getByRole('radio', { name: /Export as ZIP/ }).check();
  await dialog.getByRole('button', { name: 'Continue' }).click();
}
