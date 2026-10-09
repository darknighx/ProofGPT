import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, appendFile, mkdir, copyFile, open, stat } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { createTestProfile } from './test-profile.mjs';

const executable = path.resolve(process.env.PROOFGPT_TEST_EXE || 'release/win-unpacked/ProofGPT.exe');
const manifest = JSON.parse(await readFile('shared/model-manifest.json', 'utf8'));
const samples = JSON.parse(await readFile('detector/tests/fixtures/samples.json', 'utf8'));
const total = manifest.files.reduce((sum, file) => sum + file.size, 0);
const modelFolder = `models--${manifest.model.replaceAll('/', '--')}`;
const profile = process.env.PROOFGPT_PROGRESS_PROFILE ? path.resolve(process.env.PROOFGPT_PROGRESS_PROFILE) : await createTestProfile('model-progress');
assert.ok(profile.startsWith(path.resolve('artifacts/test-profiles') + path.sep));
console.log(`Progress test profile: ${profile}`);
await writeFile('artifacts/model-progress-current-profile.txt', profile);
const log = 'artifacts/model-progress-events.ndjson';
await writeFile(log, '');
const env = { ...process.env, PATH: path.join(process.env.SystemRoot, 'System32'), PYTHONHOME: 'C:\\unavailable', PYTHONPATH: 'C:\\unavailable', PROOFGPT_PYTHON: 'C:\\unavailable\\python.exe' };
delete env.ELECTRON_RUN_AS_NODE; delete env.PROOFGPT_DEV_URL;
for (const command of ['python', 'python3', 'py', 'pip']) assert.equal(spawnSync(command, ['--version'], { env, shell: false, windowsHide: true }).error?.code, 'ENOENT');
let app, page;
const errors = [], observed = [];
const go = (name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
const state = () => page.evaluate(() => window.desktop.model.status());
async function launch(currentProfile, offline) {
  const runtimeEnv = { ...env, HF_HUB_OFFLINE: offline ? '1' : '0' };
  if (offline) { runtimeEnv.HTTP_PROXY = runtimeEnv.HTTPS_PROXY = runtimeEnv.ALL_PROXY = 'http://127.0.0.1:9'; }
  else { delete runtimeEnv.HTTP_PROXY; delete runtimeEnv.HTTPS_PROXY; delete runtimeEnv.ALL_PROXY; }
  app = await electron.launch({ executablePath: executable, args: [`--user-data-dir=${currentProfile}`], env: runtimeEnv });
  page = await app.firstWindow(); page.setDefaultTimeout(90 * 60_000);
  page.on('pageerror', (error) => errors.push(error.message));
  await app.evaluate(({ app }) => {
    const path = process.mainModule.require('node:path');
    const { DetectorClient } = process.mainModule.require(path.join(app.getAppPath(), 'electron/detector-client.cjs'));
    const request = DetectorClient.prototype.request;
    globalThis.testProtocol = [];
    DetectorClient.prototype.request = function (method, payload, onStatus) {
      globalThis.testProtocol.push({ method, containsText: typeof payload.text === 'string' });
      return request.call(this, method, payload, onStatus);
    };
  });
  await page.exposeFunction('recordTestModelState', async (model) => { observed.push(model); await appendFile(log, JSON.stringify({ time: Date.now(), profile: currentProfile, ...model }) + '\n'); });
  await page.evaluate(async () => {
    globalThis.qaModel = await window.desktop.model.status();
    globalThis.qaDetectorStatuses = [];
    window.desktop.onModelState((model) => { globalThis.qaModel = model; void window.recordTestModelState(model).catch(() => {}); });
    window.desktop.onDetectorStatus((status) => globalThis.qaDetectorStatuses.push(status));
  });
}
async function close() { await app.close(); app = null; }
async function engine() {
  const pid = await app.evaluate(() => process.pid);
  const output = execFileSync(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-Command',
    `@(Get-CimInstance Win32_Process -Filter 'ParentProcessId=${pid}' | Where-Object Name -eq 'ProofGPTDetector.exe' | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress`], { windowsHide: true, encoding: 'utf8' });
  const parsed = JSON.parse(output), engines = Array.isArray(parsed) ? parsed : [parsed];
  assert.equal(engines.length, 1);
  assert.equal(engines[0].ExecutablePath, path.join(path.dirname(executable), 'resources/detector-runtime/ProofGPTDetector.exe'));
  assert.equal(engines[0].CommandLine.includes(samples[0].text), false);
  return engines[0];
}
async function submit(sample) {
  await go('Home');
  await page.getByRole('textbox', { name: 'Text to analyze' }).fill(sample.text);
  await page.getByRole('button', { name: 'Analyze Text', exact: true }).click();
  await page.getByRole('button', { name: 'Analyzing...', exact: true }).waitFor();
}
async function waitReady() {
  for (let retry = 0; retry < 4; retry++) {
    await page.waitForFunction(() => ['ready', 'failed'].includes(globalThis.qaModel.status));
    if ((await state()).status === 'ready') return;
    if (retry === 3) throw new Error((await state()).error);
    console.log(`Retrying interrupted transfer: ${(await state()).error}`);
    await go('Settings');
    await page.getByRole('button', { name: 'Retry Download', exact: true }).click();
    await page.waitForFunction(() => globalThis.qaModel.status === 'downloading');
    await submit(samples[0]);
  }
}
try {
  await launch(profile, true);
  await go('Settings');
  assert.equal((await state()).status, 'not-downloaded');
  await page.getByTestId('model-local-status').filter({ hasText: 'Model not downloaded' }).waitFor();
  await page.getByRole('button', { name: 'Download Model', exact: true }).click();
  await page.getByTestId('model-local-status').filter({ hasText: 'Model download failed' }).waitFor();
  assert.doesNotMatch(await page.locator('.model-download-error').innerText(), /Python|pip|traceback|Setup Detector/i);
  assert.equal((await page.evaluate(() => window.desktop.history.list())).records.length, 0);
  const failedSequence = (await state()).sequence;
  await page.getByRole('button', { name: 'Retry Download', exact: true }).click();
  await page.waitForFunction((sequence) => globalThis.qaModel.sequence > sequence && globalThis.qaModel.status === 'failed', failedSequence);
  await close();
  console.log('PASS: empty local cache, Settings availability, offline failure and Retry Download without inference/history.');

  await launch(profile, false); await go('Settings');
  await page.getByRole('button', { name: 'Download Model', exact: true }).click();
  await page.waitForFunction(() => globalThis.qaModel.progress?.downloadedBytes > 10000000);
  assert.equal(await page.getByRole('button', { name: 'Downloading Model...', exact: true }).isDisabled(), true);
  await page.evaluate(() => { void window.desktop.model.download(); void window.desktop.model.download(); });
  await page.waitForFunction(() => globalThis.qaModel.progress?.bytesPerSecond > 0);
  const initialEngine = await engine();
  await page.screenshot({ path: 'artifacts/model-progress-settings.png' });
  await submit(samples[0]);
  await page.locator('.model-download-status.in-home').waitFor();
  await page.screenshot({ path: 'artifacts/model-progress-home.png' });
  await go('Settings');
  assert.equal((await engine()).ProcessId, initialEngine.ProcessId);
  const requests = await app.evaluate(() => globalThis.testProtocol);
  assert.deepEqual(requests, [{ method: 'download_model', containsText: false }]);
  assert.equal(await page.getByRole('progressbar').count(), 0);
  console.log('PASS: actual live sizes/percentage/speed, Settings → Home → Settings, queued analysis and no duplicate download/process.');

  // Stop only the verified test detector to simulate interruption, retaining HF partial data.
  const beforeInterruption = (await state()).progress.downloadedBytes;
  await app.evaluate((_electron, pid) => process.kill(pid), initialEngine.ProcessId);
  await page.getByTestId('model-local-status').filter({ hasText: 'Model download failed' }).waitFor();
  assert.equal((await state()).progress, null);
  await page.getByRole('button', { name: 'Retry Download', exact: true }).click();
  await page.waitForFunction(() => globalThis.qaModel.progress !== null);
  assert.ok((await state()).progress.downloadedBytes >= beforeInterruption);
  await submit(samples[0]);
  await waitReady();
  await go('Settings'); await page.getByTestId('model-local-status').filter({ hasText: 'Model ready' }).waitFor();
  assert.equal((await state()).cachedBytes, total); assert.equal((await state()).progress, null);
  await go('Home'); await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
  assert.equal(await page.locator('.model-download-status').count(), 0);
  assert.equal((await page.evaluate(() => window.desktop.history.list())).records.length, 1);
  assert.ok((await page.evaluate(() => globalThis.qaDetectorStatuses)).some((status) => status.phase === 'loading'));
  assert.ok((await page.evaluate(() => globalThis.qaDetectorStatuses)).some((status) => status.phase === 'analyzing'));
  const completedProtocol = await app.evaluate(() => globalThis.testProtocol);
  assert.ok(completedProtocol.filter((request) => request.method === 'download_model').every((request) => !request.containsText));
  await close();
  console.log('PASS: interrupted transfer retained/resumed, model ready, waiting analysis continued, stale metrics removed.');

  const cache = path.join(profile, 'model-cache/hub', modelFolder, 'snapshots', manifest.revision);
  const weights = path.join(cache, 'model.safetensors');
  const before = await stat(weights);
  await launch(profile, true); await go('Settings');
  assert.equal((await state()).status, 'ready');
  assert.deepEqual(await app.evaluate(() => globalThis.testProtocol), []);
  await submit(samples[3]);
  await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
  assert.equal(await page.getByTestId('ai-score').innerText(), '0%');
  assert.equal((await state()).status, 'ready');
  assert.equal((await stat(weights)).mtimeMs, before.mtimeMs);
  assert.equal((await page.evaluate(() => globalThis.qaDetectorStatuses)).some((status) => status.phase === 'downloading'), false);
  await close();
  console.log('PASS: restart immediately detects ready model without a detector/network request; cached offline inference works.');

  // Reverse flow in a controlled profile: missing completed weights, retained
  // official partial bytes. Real HF Range download resumes the final 30 MB.
  const reverseProfile = await createTestProfile('model-reverse');
  const reverseRoot = path.join(reverseProfile, 'model-cache/hub', modelFolder);
  const reverseSnapshot = path.join(reverseRoot, 'snapshots', manifest.revision);
  await mkdir(reverseSnapshot, { recursive: true }); await mkdir(path.join(reverseRoot, 'blobs'), { recursive: true });
  for (const file of manifest.files.filter((file) => file.name !== 'model.safetensors')) await copyFile(path.join(cache, file.name), path.join(reverseSnapshot, file.name));
  const weightInfo = manifest.files.find((file) => file.name === 'model.safetensors');
  const partial = path.join(reverseRoot, 'blobs', weightInfo.etag + '.incomplete');
  await copyFile(weights, partial); const handle = await open(partial, 'r+'); await handle.truncate(weightInfo.size - 30000000); await handle.close();
  await launch(reverseProfile, false);
  assert.equal((await state()).status, 'not-downloaded');
  await submit(samples[0]);
  await page.locator('.model-download-status.in-home').waitFor();
  await go('Settings'); await page.locator('.model-download-status.in-settings').waitFor();
  await waitReady();
  await go('Home'); await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
  assert.equal((await page.evaluate(() => window.desktop.history.list())).records.length, 1);
  assert.deepEqual(await app.evaluate(() => globalThis.testProtocol), [{ method: 'download_model', containsText: false }, { method: 'analyze', containsText: true }]);
  assert.deepEqual(errors, []);
  const progress = observed.filter((model) => model.progress && model.progress.bytesPerSecond > 0);
  assert.ok(progress.length >= 2);
  assert.ok(new Set(progress.map((model) => model.progress.downloadedBytes)).size > 1);
  assert.ok(new Set(progress.map((model) => model.progress.percentage)).size > 1);
  await writeFile('artifacts/model-download-regression.json', JSON.stringify({ executable, profile, reverseProfile, totalBytes: total, liveProgressSamples: progress.length,
    settingsDownload: true, sharedState: true, duplicatePrevention: true, interruptedAndResumed: true, automaticAnalysis: true,
    restartLocalCheck: true, cachedOffline: true, reverseFlow: 'real official HTTP resume of retained partial cache', pythonUnavailable: true, errors, status: 'passed' }, null, 2));
  console.log('PASS: Home-triggered reverse flow shares Settings progress and automatically completes analysis; no renderer errors.');
} finally { if (app) await close(); }
