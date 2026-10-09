import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import { createTestProfile } from './test-profile.mjs';

const verified = JSON.parse(await readFile('artifacts/release-regression.json', 'utf8'));
assert.equal(verified.status, 'passed');
assert.equal(verified.pythonCommandsUnavailable, true);
assert.equal(verified.firstDownload, true);
const executable = path.resolve('artifacts/installed/ProofGPT/ProofGPT.exe');
const env = { ...process.env, PATH: path.join(process.env.SystemRoot, 'System32'), HF_HUB_OFFLINE: '1',
  HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', ALL_PROXY: 'http://127.0.0.1:9',
  PROOFGPT_PYTHON: 'C:\\unavailable\\python.exe', PYTHONHOME: 'C:\\unavailable', PYTHONPATH: 'C:\\unavailable',
  HF_HOME: path.resolve('artifacts/ignored-cache'), HF_HUB_DISABLE_XET: '0' };
delete env.ELECTRON_RUN_AS_NODE; delete env.PROOFGPT_DEV_URL;
for (const command of ['python', 'python3', 'py', 'pip']) assert.equal(spawnSync(command, ['--version'], { env, shell: false, windowsHide: true }).error?.code, 'ENOENT');
let app;
async function launch(profile) {
  app = await electron.launch({ executablePath: executable, args: [`--user-data-dir=${profile}`], env });
  const page = await app.firstWindow(); page.setDefaultTimeout(300000);
  return page;
}
async function close() { await app.close(); app = null; }
const samples = JSON.parse(await readFile('detector/tests/fixtures/samples.json', 'utf8'));
try {
  const emptyProfile = await createTestProfile('final-empty-model');
  let page = await launch(emptyProfile);
  await page.getByRole('textbox', { name: 'Text to analyze' }).fill(samples[0].text);
  await page.getByRole('button', { name: 'Analyze Text', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').innerText(), /model could not be downloaded/);
  assert.doesNotMatch(await page.getByRole('alert').innerText(), /Python|dependencies|Setup Detector/);
  assert.deepEqual((await page.evaluate(() => window.desktop.history.list())).records, []);
  await close();

  const before = await stat(verified.cache);
  const historyBefore = await readFile(path.join(verified.profile, 'history.json'));
  const settingsBefore = await readFile(path.join(verified.profile, 'settings.json'));
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const installer = path.resolve(`release/ProofGPT-Setup-${version}-x64.exe`);
  const installation = spawnSync(installer, ['/S', '--no-desktop-shortcut', `/D=${path.dirname(executable)}`], { shell: false, windowsHide: true, timeout: 180000 });
  if (installation.error) throw installation.error;
  assert.equal(installation.status, 0);
  assert.deepEqual(await readFile(path.join(verified.profile, 'history.json')), historyBefore);
  assert.deepEqual(await readFile(path.join(verified.profile, 'settings.json')), settingsBefore);
  assert.equal((await stat(verified.cache)).mtimeMs, before.mtimeMs);
  page = await launch(verified.profile);
  await page.getByTestId('report-total').waitFor();
  const oldRecords = (await page.evaluate(() => window.desktop.history.list())).records;
  assert.ok(oldRecords.length >= 1);
  assert.equal((await page.evaluate(() => window.desktop.settings.get())).settings.defaultExportFormat, 'json');
  await page.evaluate(() => { globalThis.qaStatuses = []; window.desktop.onDetectorStatus((status) => globalThis.qaStatuses.push(status)); });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('textbox', { name: 'Text to analyze' }).fill(samples[3].text);
  await page.getByRole('button', { name: 'Analyze Text', exact: true }).click();
  await page.getByRole('heading', { name: 'Analysis result', exact: true }).waitFor();
  const records = (await page.evaluate(() => window.desktop.history.list())).records;
  assert.equal(records.length, oldRecords.length + 1);
  assert.equal(records[1].id, oldRecords[0].id);
  assert.equal(records[0].aiProbability, 0);
  assert.equal(await page.evaluate(() => globalThis.qaStatuses.some((status) => status.phase === 'downloading')), false);
  const after = await stat(verified.cache);
  assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs);
  const mainPid = await app.evaluate(() => process.pid);
  const engine = JSON.parse(execFileSync(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-Command',
    `Get-CimInstance Win32_Process -Filter 'ParentProcessId=${mainPid}' | Where-Object Name -eq 'ProofGPTDetector.exe' | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress`], { windowsHide: true, encoding: 'utf8' }));
  assert.equal(engine.ExecutablePath, path.join(path.dirname(executable), 'resources/detector-runtime/ProofGPTDetector.exe'));
  const sockets = execFileSync(path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoProfile', '-Command',
    `@(Get-NetTCPConnection -OwningProcess ${engine.ProcessId} -ErrorAction SilentlyContinue | Where-Object State -eq 'Established').Count`], { windowsHide: true, encoding: 'utf8' });
  assert.equal(Number(sockets.trim()), 0);
  await writeFile('artifacts/final-installed-check.json', JSON.stringify({ installer, installerReinstalled: true, executable, profile: verified.profile, cache: verified.cache,
    engine, pythonUnavailable: true, offline: true, noEngineNetworkConnections: true, cacheUnchangedAfterUpgrade: true,
    historyAndPreferencesPreserved: true, emptyCacheError: true, result: records[0].aiProbability, status: 'passed' }, null, 2));
  console.log('PASS: final installed version, no Python/pip, useful empty-cache error, upgrade preserves preferences/history/weights, real cached offline inference, no detector TCP connections.');
} finally { if (app) await close(); }
