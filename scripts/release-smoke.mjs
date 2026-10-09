import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { createTestProfile } from './test-profile.mjs';

const executable = path.resolve(process.env.PROOFGPT_TEST_EXE || 'release/win-unpacked/ProofGPT.exe');
await stat(executable);
const samples = JSON.parse(await readFile('detector/tests/fixtures/samples.json', 'utf8'));
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
// A failed/interrupted first-use download can be resumed in its isolated profile.
const profile = process.env.PROOFGPT_TEST_PROFILE ? path.resolve(process.env.PROOFGPT_TEST_PROFILE) : await createTestProfile('release');
if (!profile.startsWith(path.resolve('artifacts/test-profiles') + path.sep)) throw new Error('Release tests require an isolated workspace test profile.');
const downloadProofPath = process.env.PROOFGPT_FIRST_DOWNLOAD_PROOF && path.resolve(process.env.PROOFGPT_FIRST_DOWNLOAD_PROOF);
let downloadProof;
if (downloadProofPath) {
  if (!downloadProofPath.startsWith(path.resolve('artifacts') + path.sep)) throw new Error('Download proof must be a workspace test artifact.');
  downloadProof = JSON.parse(await readFile(downloadProofPath, 'utf8'));
  assert.equal(downloadProof.profile, profile);
  assert.equal(downloadProof.status, 'passed');
  assert.equal(downloadProof.phaseAssertionsPassed, true);
  assert.equal((await stat(downloadProof.cache)).size, downloadProof.cacheBytes);
}
const baseEnv = { ...process.env, PATH: path.join(process.env.SystemRoot, 'System32'), HF_HUB_OFFLINE: '1',
  HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', ALL_PROXY: 'http://127.0.0.1:9',
  PROOFGPT_PYTHON: path.join(profile, 'unavailable-python.exe'), PYTHONHOME: path.join(profile, 'invalid-python-home'), PYTHONPATH: path.join(profile, 'invalid-python-path'),
  HF_HOME: path.join(profile, 'ignored-inherited-cache') };
baseEnv.HF_HUB_DISABLE_XET = '1';
delete baseEnv.ELECTRON_RUN_AS_NODE; delete baseEnv.PROOFGPT_DEV_URL;
for (const command of ['python', 'python3', 'py', 'pip']) assert.equal(spawnSync(command, ['--version'], { env: baseEnv, shell: false, windowsHide: true }).error?.code, 'ENOENT', command);
const realEnv = { ...baseEnv, HF_HUB_OFFLINE: '0' };
delete realEnv.HTTP_PROXY; delete realEnv.HTTPS_PROXY; delete realEnv.ALL_PROXY;
const errors = [], appErrors = [];
let app, page;
const go = (name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
const history = async () => (await page.evaluate(() => window.desktop.history.list())).records;
async function launch(env) {
  app = await electron.launch({ executablePath: executable, args: [`--user-data-dir=${profile}`], env });
  page = await app.firstWindow(); page.setDefaultTimeout(90 * 60_000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  app.process().stderr.on('data', (data) => { if (/UnhandledPromiseRejection|UncaughtException|TypeError:|ReferenceError:/.test(String(data))) appErrors.push(String(data)); });
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
  assert.equal(await app.evaluate(({ app }) => app.getVersion()), metadata.version);
  if (process.env.PROOFGPT_TEST_DIAGNOSTICS === '1') {
    // Test-only instrumentation of the loaded class; production stays quiet.
    await app.evaluate(({ app }) => {
      const path = process.mainModule.require('node:path');
      const { DetectorClient } = process.mainModule.require(path.join(app.getAppPath(), 'electron/detector-client.cjs'));
      const start = DetectorClient.prototype.start;
      globalThis.engineStderr = '';
      DetectorClient.prototype.start = async function (pending) {
        this.diagnostics = true;
        await start.call(this, pending);
        this.child?.stderr.on('data', (data) => { globalThis.engineStderr = (globalThis.engineStderr + data).slice(-64000); });
      };
    });
  }
}
async function close() { await app.close(); app = null; }
async function engineProcess() {
  // Playwright can wrap the app in a launcher process; query the Electron PID.
  const mainPid = await app.evaluate(() => process.pid);
  const output = execFileSync(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter 'ParentProcessId=${mainPid}' | Select-Object Name,ExecutablePath,ProcessId,ParentProcessId | ConvertTo-Json -Compress`], { windowsHide: true, encoding: 'utf8' });
  const processes = JSON.parse(output); const found = (Array.isArray(processes) ? processes : [processes]).find((item) => item.Name === 'ProofGPTDetector.exe');
  assert.equal(found?.ExecutablePath, path.join(path.dirname(executable), 'resources/detector-runtime/ProofGPTDetector.exe'));
  return found;
}
async function analyze(sample) {
  await go('AI Detector');
  assert.equal(await page.locator('[aria-current="page"]').innerText(), 'AI Detector');
  await page.getByRole('textbox', { name: 'Text to analyze' }).fill(sample.text);
  assert.equal(await page.locator('.analysis-result').count(), 0);
  await page.getByRole('button', { name: 'Analyze Text', exact: true }).click();
  const busy = page.getByRole('button', { name: 'Analyzing...', exact: true });
  await busy.waitFor(); assert.equal(await busy.isDisabled(), true);
  await busy.evaluate((element) => { element.click(); element.click(); });
  await Promise.race([
    page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor(),
    page.getByRole('alert').waitFor().then(async () => {
      if (process.env.PROOFGPT_TEST_DIAGNOSTICS === '1') {
        const diagnostic = await app.evaluate(() => globalThis.engineStderr);
        await writeFile('artifacts/frozen-error.log', diagnostic.replace(/(https?:\/\/[^?\s"']+)\?[^\s"']+/g, '$1?[redacted]'));
      }
      throw new Error(await page.getByRole('alert').innerText());
    }),
  ]);
  const record = (await history())[0];
  assert.equal(record.text, sample.text);
  assert.equal(record.characterCount, sample.text.length);
  assert.equal(await page.getByTestId('ai-score').innerText(), `${record.aiProbability}%`);
  assert.equal(await page.getByTestId('human-score').innerText(), `${record.humanProbability}%`);
  assert.ok(Math.abs(record.aiProbability + record.humanProbability - 100) < 0.02);
  assert.equal(await page.locator('.result-verdict > .classification').innerText(), record.classification);
  assert.match(await page.locator('.result-verdict').innerText(), new RegExp(`Confidence: ${record.confidence}`));
  assert.deepEqual(await page.locator('.result-stats dd').allTextContents(), [record.wordCount, record.characterCount, record.sentenceCount].map((value) => value.toLocaleString('en-US')));
  assert.equal(await page.getByRole('textbox', { name: 'Text to analyze' }).inputValue(), sample.text);
  return record;
}
try {
  if (!process.env.PROOFGPT_TEST_PROFILE) {
  await launch(baseEnv);
  await page.evaluate(() => { globalThis.qaStatuses = []; window.desktop.onDetectorStatus((status) => globalThis.qaStatuses.push(status)); });
  await page.getByRole('textbox', { name: 'Text to analyze' }).fill(samples[0].text);
  await page.getByRole('button', { name: 'Analyze Text', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /model could not be downloaded/);
  assert.doesNotMatch(await page.getByRole('alert').innerText(), /Python|dependencies|Setup Detector/i);
  assert.ok(await page.evaluate(() => globalThis.qaStatuses.some((status) => status.phase === 'downloading' && status.message.includes('GB'))));
  assert.equal(await page.locator('.analysis-result').count(), 0);
  await close();
  console.log('PASS: no Python commands available; empty offline cache gives model download error/progress, no setup instructions or fake result.');
  }

  await launch(realEnv);
  if (downloadProof) {
    // Restart the remaining regression with the genuinely downloaded cache.
    // Only this isolated test profile's records/preferences are reset.
    assert.ok((await history()).some((record) => record.id === downloadProof.firstResult.id));
    await page.evaluate(async () => { await window.desktop.history.clear(); await window.desktop.settings.restoreDefaults(); });
  }
  await page.evaluate(() => { globalThis.qaStatuses = []; window.desktop.onDetectorStatus((status) => globalThis.qaStatuses.push(status)); });
  const first = await analyze(samples[0]);
  const firstStatuses = await page.evaluate(() => globalThis.qaStatuses);
  if (!downloadProof) assert.ok(firstStatuses.some((status) => status.phase === 'downloading' && status.message.includes('1.74 GB')));
  else assert.equal(firstStatuses.some((status) => status.phase === 'downloading'), false);
  assert.ok(firstStatuses.some((status) => status.phase === 'loading'));
  assert.ok(firstStatuses.some((status) => status.phase === 'analyzing'));
  if (!downloadProof) {
    const cache = path.join(profile, 'model-cache/hub/models--ShantanuT01--dactyl-ai-text-detector/snapshots/b62b403cb6c5c14751b5b98b474e5f662b41cef9/model.safetensors');
    await writeFile('artifacts/first-download-proof.json', JSON.stringify({ profile, cache, cacheBytes: (await stat(cache)).size, firstResult: first, firstStatuses, phaseAssertionsPassed: true, status: 'passed' }, null, 2));
  }
  const onlineEngine = await engineProcess();
  console.log('PASS: real model download verified; installed inference uses the bundled ProofGPTDetector.exe.');
  const second = await analyze(samples[3]);
  assert.notEqual(first.aiProbability, second.aiProbability);
  assert.equal((await history()).length, 2);
  await go('History');
  assert.equal(await page.getByTestId('total-scans').innerText(), '2');
  assert.equal(await page.locator('.history-row').first().getAttribute('data-record-id'), second.id);
  await page.getByRole('searchbox', { name: 'Search history' }).fill(samples[0].text.slice(0, 45).toUpperCase());
  assert.equal(await page.locator('.history-row').count(), 1);
  await page.locator('.history-row-open').first().click();
  assert.equal(await page.locator('.history-full-text p').innerText(), first.text);
  await page.getByRole('button', { name: 'Back to History', exact: true }).click();
  await go('Reports');
  assert.equal(await page.getByTestId('report-total').innerText(), '2');
  const average = Math.round((first.aiProbability + second.aiProbability) / 2 * 100) / 100;
  assert.equal(await page.getByTestId('report-average').innerText(), `${average}%`);
  assert.equal(await page.locator('.report-trend-point').count(), 2);
  await go('Settings');
  assert.equal(await page.getByRole('combobox', { name: 'Language', exact: true }).isDisabled(), true);
  await page.getByRole('combobox', { name: 'Default export format', exact: true }).selectOption('json');
  await page.waitForFunction(() => !document.querySelector('select[aria-labelledby="export-format-label"]').disabled);
  await page.getByRole('combobox', { name: 'Start-up', exact: true }).selectOption('reports');
  await page.waitForFunction(() => !document.querySelector('select[aria-labelledby="startup-label"]').disabled);
  await close();
  // Saved reports/details work without Python and never rerun detection.
  await launch(baseEnv);
  await page.getByTestId('report-total').waitFor();
  assert.equal(await page.locator('[aria-current="page"]').innerText(), 'Reports');
  assert.equal((await page.evaluate(() => window.desktop.settings.get())).settings.defaultExportFormat, 'json');
  assert.equal((await history()).length, 2);
  await page.locator('.report-title-button').first().click();
  await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
  assert.equal(await page.locator('.history-full-text p').innerText(), second.text);
  await go('Help');
  await page.getByRole('searchbox', { name: 'Search help articles', exact: true }).fill('HISTORY');
  assert.ok(await page.getByRole('button', { name: /Managing your history/ }).count());
  // The handler opens an actual unpacked resource, not an ASAR virtual path.
  await app.evaluate(({ shell }) => { shell.openPath = async (file) => { globalThis.releaseDocumentationPath = file; return ''; }; });
  await page.getByRole('button', { name: 'Open documentation', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.help-documentation-category').disabled);
  const documentation = await app.evaluate(() => globalThis.releaseDocumentationPath);
  assert.equal(documentation, path.join(path.dirname(executable), 'resources/README.md'));
  assert.match(await readFile(documentation, 'utf8'), /ProofGPT includes its detection runtime/);
  await go('History');
  await page.locator('.history-delete').first().click();
  await page.getByRole('dialog').press('Escape');
  assert.equal((await history()).length, 2);
  await page.locator('.history-delete').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete analysis', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await go('Reports');
  assert.equal(await page.getByTestId('report-total').innerText(), '1');
  assert.equal(await page.getByTestId('report-average').innerText(), `${first.aiProbability}%`);
  const exportedFile = path.join(profile, 'selected.csv');
  await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, exportedFile);
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Report saved' }).waitFor();
  const exported = await readFile(exportedFile, 'utf8');
  assert.ok(exported.includes(first.id)); assert.equal(exported.includes(second.id), false);
  for (const [width, height] of [[1536, 1024], [1200, 800], [850, 660]]) {
    await app.evaluate(({ BrowserWindow }, dimensions) => BrowserWindow.getAllWindows()[0].setSize(...dimensions), [width, height]);
    for (const name of ['Home', 'AI Detector', 'History', 'Reports', 'Settings', 'Help']) {
      await go(name);
      assert.equal(await page.locator('[aria-current="page"]').count(), 1);
      assert.equal(await page.locator('[aria-current="page"]').innerText(), name);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('main:visible').evaluate((element) => element.scrollWidth > element.clientWidth), false, `${name} overflow at ${width}`);
      assert.equal(await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Help', exact: true }).isVisible(), true);
      if (width === 1536) await page.screenshot({ path: `artifacts/release-${name.toLowerCase().replaceAll(' ', '-')}.png` });
    }
  }
  await go('History');
  await page.getByRole('button', { name: 'Clear History', exact: true }).click();
  const bounds = await page.getByRole('dialog').boundingBox();
  assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 660);
  await page.getByRole('dialog').getByRole('button', { name: 'Clear History', exact: true }).click();
  await page.getByRole('heading', { name: 'No analyses yet', exact: true }).waitFor();
  await go('Reports');
  await page.getByRole('heading', { name: 'No report data yet', exact: true }).waitFor();
  assert.deepEqual(JSON.parse(await readFile(path.join(profile, 'history.json'), 'utf8')).records, []);
  await close(); await launch(baseEnv);
  await page.getByRole('heading', { name: 'No report data yet', exact: true }).waitFor();
  await page.evaluate(() => { globalThis.qaStatuses = []; window.desktop.onDetectorStatus((status) => globalThis.qaStatuses.push(status)); });
  const offlineResult = await analyze(samples[1]);
  const offlineStatuses = await page.evaluate(() => globalThis.qaStatuses);
  assert.equal(offlineStatuses.some((status) => status.phase === 'downloading'), false);
  const offlineEngine = await engineProcess();
  const cache = path.join(profile, 'model-cache/hub/models--ShantanuT01--dactyl-ai-text-detector/snapshots/b62b403cb6c5c14751b5b98b474e5f662b41cef9/model.safetensors');
  assert.ok((await stat(cache)).size > 1700000000);
  assert.equal((await history()).length, 1);
  await go('Reports'); assert.equal(await page.getByTestId('report-total').innerText(), '1');
  assert.deepEqual(errors, []); assert.deepEqual(appErrors, []);
  await writeFile('artifacts/release-regression.json', JSON.stringify({ applicationVersion: metadata.version, executable, profile, cache,
    pythonCommandsUnavailable: true, firstDownload: true, firstDownloadProof: downloadProofPath || path.resolve('artifacts/first-download-proof.json'), offline: true, onlineEngine, offlineEngine, firstStatuses, offlineStatuses,
    results: [first.aiProbability, second.aiProbability, offlineResult.aiProbability], status: 'passed', rendererErrors: errors, applicationErrors: appErrors }, null, 2));
  console.log('PASS: packaged real inference/reanalysis, counts, saved detail, metrics, preferences/restart, Help/docs, delete/cancel, filtered export, clear, reanalysis, all six navigation buttons, three sizes, modal bounds, no app/renderer errors.');
} finally { if (app) await close(); }
