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

test('edits, saves, renames a collection item, restores a backup, and previews cleanly', async ({ page }) => {
  const siteTitle = uniqueName('Workflow');
  const itemTitle = uniqueName('Post');

  await gotoDashboard(page);
  const siteId = await createUnprotectedSite(page, siteTitle);

  // Create a collection via the sidebar accordion
  await page.getByText('Collections', { exact: true }).click();
  const createCollectionButton = page.getByTitle('Create Collection');
  await createCollectionButton.click();
  await expect(page.getByRole('heading', { name: 'Create New Collection' })).toBeVisible();
  await page.getByLabel('Collection Name').fill('Blog');
  await page.locator('#item-layout-select').click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Create Collection', exact: true }).click();

  // Open the collection and add an item
  await page.getByText('Blog').first().click();
  await expect(page).toHaveURL(new RegExp(`#/sites/${siteId}/collections/.+`));
  await page.getByRole('link', { name: /Add post|Add your first item/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`#/sites/${siteId}/edit/content/.+`));

  // Edit the title and body, then save and reload
  const titleBox = page.getByLabel('Title', { exact: true });
  await titleBox.fill(itemTitle);
  const editor = page.locator('.ProseMirror[contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.press(selectAllShortcut);
  await page.keyboard.press('Backspace');
  await page.keyboard.type('Workflow body text.');
  // Click the title field (not focus()) so the typed body text stays in the
  // editor; focus() selects nothing but the subsequent click can still move
  // the caret — clicking the title input blurs the editor cleanly.
  await page.getByRole('textbox', { name: 'Title', exact: true }).click();
  // The SaveButton is an icon-only button with no accessible name; its text
  // ('Save'/'Saving...'/'Saved') only renders inside a hover tooltip, so assert
  // on the persisted state instead. In the editor header the save control is
  // the only button without an aria-label (sidebar toggles, preview, publish
  // all have one). First creation writes through the store and then navigates
  // away from the /_new URL with replace:true — wait for that app-emitted
  // navigation before asserting.
  const header = page.locator('header').first();
  const saveButton = header.locator('button:not([aria-label])');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await page.waitForURL((url) => !url.hash.includes('/_new'), { timeout: 15000 });

  // Rename by editing the slug, save, reload — the new URL must hold the content.
  // The slug change navigates via setTimeout after the store reload settles, so
  // the URL assertion (not the click) carries the generous timeout.
  const slugInput = page.getByLabel('Page slug');
  await slugInput.fill('blog/renamed-post');
  await expect(slugInput).toHaveValue('blog/renamed-post', { timeout: 5000 });
  await header.locator('button:not([aria-label])').click();
  await expect(page).toHaveURL(/#\/sites\/.+\/edit\/content\/blog\/renamed-post$/, { timeout: 15000 });
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(itemTitle);

  // Export a backup, delete the site, restore from the ZIP, and confirm content
  await page.goto('/#/');
  await expect(page.getByRole('link', { name: siteTitle })).toBeVisible();
  const siteCard = page.locator('div.border-b').filter({ hasText: siteTitle });
  await siteCard.getByRole('button').last().click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  if (!backupPath) throw new Error('Backup download has no filesystem path');

  await siteCard.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Delete site' }).click();
  await page.getByRole('button', { name: 'Yes, delete site' }).click();
  await expect(page.getByRole('link', { name: siteTitle })).toBeHidden({ timeout: 15000 });

  await page.getByRole('button', { name: 'Import site' }).click();
  await page.getByRole('menuitem', { name: 'Upload ZIP file' }).click();
  await page.setInputFiles('input[type="file"]', backupPath);
  await expect(page.getByRole('link', { name: siteTitle })).toBeVisible({ timeout: 15000 });
  // Preview the restored collection item in the viewer. A fresh site has no
  // homepage yet, so the viewer root shows the empty state; the item lives at
  // its slug path.
  await page.getByRole('link', { name: siteTitle }).click();
  await page.getByTitle('View site').click();
  await page.locator('input.browser-address-bar').fill('/blog/renamed-post');
  await page.keyboard.press('Enter');
  const frame = page.frameLocator('iframe[title]');
  await expect(frame.getByText('Workflow body text.')).toBeVisible({ timeout: 15000 });
});
