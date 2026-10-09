import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile, open, stat } from 'node:fs/promises';
import path from 'node:path';
import { createTestProfile } from './test-profile.mjs';

// Final-build reverse flow with real official HTTP resume. The missing completed
// weights file is deliberately prepared only in a controlled workspace profile.
const executable = path.resolve('release/win-unpacked/ProofGPT.exe');
const manifest = JSON.parse(await readFile('shared/model-manifest.json', 'utf8'));
const samples = JSON.parse(await readFile('detector/tests/fixtures/samples.json', 'utf8'));
const modelFolder = `models--${manifest.model.replaceAll('/', '--')}`;
const profile = await createTestProfile('model-final');
const root = path.join(profile, 'model-cache/hub', modelFolder);
const snapshot = path.join(root, 'snapshots', manifest.revision);
await mkdir(snapshot, { recursive: true }); await mkdir(path.join(root, 'blobs'), { recursive: true });
const source = path.resolve('.model-cache/hub', modelFolder, 'snapshots', manifest.revision);
for (const file of manifest.files.filter((file) => file.name !== 'model.safetensors')) await copyFile(path.join(source, file.name), path.join(snapshot, file.name));
const weights = manifest.files.find((file) => file.name === 'model.safetensors');
const partial = path.join(root, 'blobs', weights.etag + '.incomplete');
await copyFile(path.join(source, weights.name), partial);
const file = await open(partial, 'r+'); await file.truncate(weights.size - 50000000); await file.close();
const env = { ...process.env, PATH: path.join(process.env.SystemRoot, 'System32'), PROOFGPT_PYTHON: 'C:\\unavailable\\python.exe', PYTHONHOME: 'C:\\unavailable', PYTHONPATH: 'C:\\unavailable' };
delete env.ELECTRON_RUN_AS_NODE; delete env.PROOFGPT_DEV_URL; delete env.HTTP_PROXY; delete env.HTTPS_PROXY; delete env.ALL_PROXY;
let app, page;
const errors = [], progress = [];
const go = (name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
async function launch(offline) {
  const runtimeEnv = { ...env, HF_HUB_OFFLINE: offline ? '1' : '0' };
  if (offline) runtimeEnv.HTTP_PROXY = runtimeEnv.HTTPS_PROXY = runtimeEnv.ALL_PROXY = 'http://127.0.0.1:9';
  app = await electron.launch({ executablePath: executable, args: [`--user-data-dir=${profile}`], env: runtimeEnv });
  page = await app.firstWindow(); page.setDefaultTimeout(300000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.exposeFunction('observeFinalProgress', (state) => { if (state.progress) progress.push(state.progress); });
  await page.evaluate(async () => {
    globalThis.finalModel = await window.desktop.model.status();
    window.desktop.onModelState((state) => { globalThis.finalModel = state; void window.observeFinalProgress(state).catch(() => {}); });
  });
}
async function close() { await app.close(); app = null; }
async function analyze(sample) {
  await go('Home');
  await page.getByRole('textbox', { name: 'Text to analyze' }).fill(sample.text);
  await page.getByRole('button', { name: 'Analyze Text', exact: true }).click();
}
try {
  await launch(false);
  assert.equal((await page.evaluate(() => window.desktop.model.status())).status, 'not-downloaded');
  await analyze(samples[0]);
  await page.waitForFunction(() => globalThis.finalModel.progress !== null);
  await page.locator('.model-download-status.in-home').waitFor();
  await go('Settings');
  await page.locator('.model-download-status.in-settings').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Downloading Model...', exact: true }).isDisabled(), true);
  await page.waitForFunction(() => globalThis.finalModel.status === 'ready');
  await page.getByTestId('model-local-status').filter({ hasText: 'Model ready' }).waitFor();
  await go('Home'); await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
  assert.equal(await page.locator('.model-download-status').count(), 0);
  assert.equal(await page.getByTestId('ai-score').innerText(), '100%');
  assert.equal((await page.evaluate(() => window.desktop.history.list())).records.length, 1);
  assert.ok(progress.some((sample) => sample.bytesPerSecond > 0));
  assert.ok(new Set(progress.map((sample) => sample.downloadedBytes)).size > 1);
  await close();
  console.log('PASS: final frozen build, real HF resumed transfer, Home-triggered download, shared Settings metrics, automatic analysis and no stale progress.');

  const before = await stat(path.join(snapshot, weights.name));
  await launch(true); await go('Settings');
  await page.getByTestId('model-local-status').filter({ hasText: 'Model ready' }).waitFor();
  await page.locator('.settings-detection-model').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/model-final-settings-ready.png' });
  await analyze(samples[3]); await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
  assert.equal(await page.getByTestId('ai-score').innerText(), '0%');
  assert.equal((await stat(path.join(snapshot, weights.name))).mtimeMs, before.mtimeMs);
  assert.equal((await page.evaluate(() => window.desktop.history.list())).records.length, 2);
  for (const dimensions of [[1536, 1024], [850, 660]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setSize(...size), dimensions);
    for (const name of ['Home', 'AI Detector', 'History', 'Reports', 'Settings', 'Help']) {
      await go(name);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('main:visible').evaluate((element) => element.scrollWidth > element.clientWidth), false);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile('artifacts/model-final-regression.json', JSON.stringify({ executable, profile, frozenManifest: JSON.parse(await readFile('detector/dist/proofgpt-detector/runtime-manifest.json', 'utf8')),
    source: 'Official retained model bytes plus real Hugging Face HTTP resume of the final 50 MB', progressSamples: progress.length,
    sharedProgress: true, automaticAnalysis: true, cachedOffline: true, restartReady: true, historyPreserved: true, allPagesResponsive: true, errors, status: 'passed' }, null, 2));
  console.log('PASS: final packaged model ready after restart, unchanged cache, real offline inference, saved history and all six pages at two sizes.');
} finally { if (app) await close(); }
