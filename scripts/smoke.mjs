import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createTestProfile } from './test-profile.mjs';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.PROOFGPT_DEV_URL;
const profile = await createTestProfile('home');
const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('heading', { name: 'Detect AI-Generated Text' }).waitFor();
  const input = page.getByRole('textbox', { name: 'Text to analyze' });
  await input.fill('ProofGPT input check');
  assert.equal(await page.locator('#character-count').innerText(), '20 / 15,000 chars');
  await input.fill('');
  await input.pressSequentially('Hello ProofGPT');
  assert.equal(await page.locator('#character-count').innerText(), '14 / 15,000 chars');
  await app.evaluate(({ clipboard }) => {
    globalThis.savedClipboard = clipboard.availableFormats().map((format) => [format, clipboard.readBuffer(format)]);
    clipboard.writeText('x'.repeat(15_100));
  });
  try {
    await input.selectText();
    await input.press('Control+V');
  } finally {
    await app.evaluate(({ clipboard }) => {
      clipboard.clear();
      for (const [format, buffer] of globalThis.savedClipboard) clipboard.writeBuffer(format, buffer);
    });
  }
  await page.waitForFunction(() => document.querySelector('textarea').value.length === 15000);
  assert.equal(await input.inputValue(), 'x'.repeat(15_000));
  assert.equal(await page.locator('#character-count').innerText(), '15,000 / 15,000 chars');
  const button = page.getByRole('button', { name: 'Analyze Text', exact: true });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
  await page.waitForFunction(() => document.hasFocus());
  await page.mouse.move(5, 5);
  const normalFilter = await button.evaluate((element) => getComputedStyle(element).filter);
  await button.hover();
  await page.waitForFunction(() => {
    const element = document.querySelector('.analyze-button');
    return element.matches(':hover') && getComputedStyle(element).filter !== 'none';
  });
  assert.notEqual(await button.evaluate((element) => getComputedStyle(element).filter), normalFilter);
  await page.mouse.down();
  await page.waitForFunction(() => {
    const element = document.querySelector('.analyze-button');
    return element.matches(':active') && getComputedStyle(element).transform !== 'none';
  });
  assert.notEqual(await button.evaluate((element) => getComputedStyle(element).transform), 'none');
  await page.mouse.up();
  // AI Detector is an alternate entry to the same Home workflow, retaining input.
  await page.getByRole('button', { name: 'AI Detector', exact: true }).click();
  assert.equal(await input.inputValue(), 'x'.repeat(15_000));
  assert.equal(await page.locator('[aria-current="page"]').innerText(), 'AI Detector');
  assert.equal(await input.evaluate((element) => element === document.activeElement), true);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await input.fill('');
  await page.getByRole('heading').click();
  await mkdir('artifacts', { recursive: true });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1412, 1048));
  await page.waitForTimeout(150);
  assert.equal(await page.locator('main').evaluate((element) => element.scrollHeight > element.clientHeight), false);
  await page.screenshot({ path: 'artifacts/home-desktop.png' });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 700));
  await page.screenshot({ path: 'artifacts/home-compact.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await page.locator('main').evaluate((element) => element.scrollWidth > element.clientWidth), false);
  assert.deepEqual(errors, []);
  console.log('PASS: Electron launch, typing, paste limit, counter, hover/press, Home/Detector navigation, resizing, renderer errors.');
} finally {
  await app.close();
}
