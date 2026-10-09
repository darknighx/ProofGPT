import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createTestProfile } from './test-profile.mjs';

const profile = await createTestProfile('help');
const env = { ...process.env, HF_HUB_OFFLINE: '1', PROOFGPT_PYTHON: path.resolve('artifacts/missing-help-python.exe') };
delete env.ELECTRON_RUN_AS_NODE; delete env.PROOFGPT_DEV_URL;
const launch = () => electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
const errors = [];
let app, page;
const go = (name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
const query = () => page.getByRole('searchbox', { name: 'Search help articles', exact: true });
const categoryButtons = () => page.getByRole('navigation', { name: 'Help categories' }).locator('[data-category]');
async function start() {
  app = await launch(); page = await app.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('heading', { name: 'Detect AI-Generated Text' }).waitFor();
}
try {
  await start();
  const originalSettings = await page.evaluate(() => window.desktop.settings.get());
  await page.getByRole('textbox', { name: 'Text to analyze' }).fill('Keep this input while reading Help.');
  await go('Help');
  assert.equal(await page.locator('[aria-current="page"]').innerText(), 'Help');
  assert.equal(await page.locator('[aria-current="page"] .nav-icon').evaluate((element) => getComputedStyle(element).fill), 'none');
  await page.getByRole('main', { name: 'Help', exact: true }).waitFor();
  assert.equal(await page.locator('.help-about').innerText().then((text) => text.includes(originalSettings.version)), true);
  assert.equal(await page.locator('.help-article').count(), 6);
  assert.equal(await page.locator('.help-faq-item').count(), 6);
  await mkdir('artifacts', { recursive: true });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1536, 1024));
  await page.screenshot({ path: 'artifacts/help-desktop.png' });
  await query().fill('HiStOrY');
  assert.ok(await page.getByRole('button', { name: /Managing your history/ }).count());
  assert.ok(await page.getByRole('button', { name: 'Where is my History stored?', exact: true }).count());
  assert.equal(await page.locator('.help-filter-status').isVisible(), true);
  await query().fill('zz-no-such-help-article');
  assert.equal(await page.getByRole('heading', { name: 'No help articles found', exact: true }).isVisible(), true);
  assert.equal(await page.locator('.help-article').count(), 0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  assert.equal(await query().inputValue(), '');
  // Every category filters real content and toggles back to the full Help view.
  for (let i = 0; i < await categoryButtons().count(); i++) {
    const button = categoryButtons().nth(i);
    const title = await button.locator('strong').innerText();
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#help-articles-title').innerText(), title);
    assert.ok(await page.locator('.help-article').count() > 0);
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'), 'false');
  }
  await page.getByRole('button', { name: 'View all 10 FAQs', exact: true }).click();
  assert.equal(await page.locator('.help-faq-item').count(), 10);
  // Accordion buttons support both native keyboard activation keys.
  for (let i = 0; i < 10; i++) {
    const item = page.locator('.help-faq-item').nth(i);
    const button = item.getByRole('button');
    await button.focus(); await button.press('Enter');
    assert.equal(await button.getAttribute('aria-expanded'), 'true');
    assert.equal(await item.locator('.help-faq-answer').isVisible(), true);
    assert.ok((await item.locator('.help-faq-answer').innerText()).length > 30);
    await button.press('Space');
    assert.equal(await button.getAttribute('aria-expanded'), 'false');
    assert.equal(await item.locator('.help-faq-answer').isVisible(), false);
  }
  await page.getByRole('button', { name: 'View all 10 articles', exact: true }).click();
  assert.equal(await page.locator('.help-article').count(), 10);
  const article = page.locator('.help-article').filter({ has: page.getByRole('button', { name: /How to analyze text/ }) });
  await article.getByRole('button').press('Enter');
  assert.equal(await article.locator('ol li').count(), 5);
  assert.match(await article.innerText(), /50 words.*15,000 characters/);
  await article.getByRole('button').press('Space');
  assert.equal(await article.locator('.help-article-body').isVisible(), false);
  await page.getByRole('button', { name: /Changing app settings/ }).click();
  assert.match(await page.locator('.help-article-body:not([hidden])').innerText(), /CSV or JSON/);
  assert.match(await page.locator('.help-article-body:not([hidden])').innerText(), /Dark.*English/);
  // Test the real fixed-path IPC handler; avoid launching an external editor in automated runs.
  await app.evaluate(({ shell }) => {
    globalThis.helpOriginalOpener = shell.openPath;
    shell.openPath = async (file) => { globalThis.helpOpenedFile = file; return ''; };
  });
  for (const button of [page.getByRole('button', { name: /Documentation Open the project guide/ }), page.getByRole('button', { name: 'Open documentation', exact: true })]) {
    await button.click();
    await page.waitForFunction(() => !document.querySelector('.help-documentation-category').disabled);
    const opened = await app.evaluate(() => globalThis.helpOpenedFile);
    assert.equal(opened, path.resolve('README.md'));
    assert.match(await readFile(opened, 'utf8'), /^# ProofGPT/);
  }
  await app.evaluate(({ shell }) => { shell.openPath = async () => 'No document reader is available.'; });
  await page.getByRole('button', { name: 'Open documentation', exact: true }).click();
  assert.match(await page.getByRole('alert').innerText(), /Documentation could not be opened/);
  await app.evaluate(({ shell }) => { shell.openPath = globalThis.helpOriginalOpener; });
  await page.locator('.help-support-details').getByRole('button', { name: /Troubleshooting/ }).click();
  assert.equal(await page.locator('#help-articles-title').innerText(), 'Troubleshooting');
  assert.equal(await page.locator('#help-articles-title').evaluate((element) => element === document.activeElement), true);
  assert.equal(await page.getByRole('button', { name: /Detector will not load/ }).isVisible(), true);
  await page.getByRole('button', { name: 'Show all help', exact: true }).click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(850, 660));
  await page.screenshot({ path: 'artifacts/help-compact.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await page.getByRole('main', { name: 'Help', exact: true }).evaluate((element) => element.scrollWidth > element.clientWidth), false);
  for (const name of ['Home', 'History', 'Reports', 'Settings', 'Help']) {
    await go(name);
    assert.equal(await page.locator('[aria-current="page"]').innerText(), name);
    if (name === 'Home') assert.equal(await page.getByRole('textbox', { name: 'Text to analyze' }).inputValue(), 'Keep this input while reading Help.');
    if (name === 'Settings') {
      for (const label of ['Save analyses to History', 'Short text warning', 'Include Explanations', 'Include chart data in JSON']) assert.equal(await page.getByRole('switch', { name: label, exact: true }).count(), 1);
      assert.deepEqual(await page.getByRole('combobox', { name: 'Default export format', exact: true }).locator('option').allTextContents(), ['CSV', 'JSON']);
    }
  }
  assert.deepEqual(await page.evaluate(() => window.desktop.settings.get()), originalSettings);
  assert.deepEqual((await page.evaluate(() => window.desktop.history.list())).records, []);
  await assert.rejects(stat(path.join(profile, 'history.json')), { code: 'ENOENT' });
  await assert.rejects(stat(path.join(profile, 'settings.json')), { code: 'ENOENT' });
  await app.close(); app = null;
  await start(); await go('Help');
  await query().fill('offline');
  await page.getByRole('button', { name: 'Does ProofGPT work offline?', exact: true }).click();
  assert.match(await page.locator('.help-faq-answer:not([hidden])').innerText(), /complete model.*cached locally/);
  assert.deepEqual(errors, []);
  console.log('PASS: Electron Help navigation, title/version, search/empty state, seven categories, ten keyboard FAQs, articles, documentation IPC/errors, support action, all-page navigation/input retention, unchanged data, minimum resize and restart without Python.');
} finally { if (app) await app.close(); }
