import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { listPackage, extractFile } from '@electron/asar';
import { _electron as electron } from 'playwright';
import { createTestProfile } from './test-profile.mjs';

const directory = path.resolve('release/win-unpacked');
const archive = path.join(directory, 'resources/app.asar');
const entries = listPackage(archive).map((file) => file.replaceAll('\\', '/'));
assert.equal(entries.some((file) => /\/(?:artifacts|\.venv|\.model-cache|\.npm-cache|tests)\//.test(file) || /\/(?:history|settings)\.json$/.test(file)), false);
for (const name of await readdir('electron')) {
  if (name.endsWith('.cjs') && name !== 'python-discovery.cjs') assert.deepEqual(extractFile(archive, path.join('electron', name)), await readFile(path.join('electron', name)));
}
assert.equal(entries.includes('/electron/python-discovery.cjs'), false);
assert.deepEqual(extractFile(archive, path.join('shared', 'settings-defaults.json')), await readFile('shared/settings-defaults.json'));
assert.deepEqual(extractFile(archive, path.join('shared', 'model-manifest.json')), await readFile('shared/model-manifest.json'));
assert.deepEqual(extractFile(archive, path.join('dist', 'index.html')), await readFile('dist/index.html'));
for (const name of await readdir('dist/assets')) assert.deepEqual(extractFile(archive, path.join('dist', 'assets', name)), await readFile(path.join('dist', 'assets', name)));
const runtime = path.join(directory, 'resources/detector-runtime');
const manifest = JSON.parse(await readFile(path.join(runtime, 'runtime-manifest.json'), 'utf8'));
assert.deepEqual(await readFile(path.join(runtime, '_internal/shared/model-manifest.json')), await readFile('shared/model-manifest.json'));
const pythonDLL = `python${manifest.python.split('.').slice(0, 2).join('')}.dll`;
for (const name of ['ProofGPTDetector.exe', 'runtime-manifest.json', `_internal/${pythonDLL}`, '_internal/torch/lib/torch_cpu.dll']) {
  assert.deepEqual(await readFile(path.join(runtime, name)), await readFile(path.join('detector/dist/proofgpt-detector', name)));
}
assert.deepEqual(await readFile(path.join(directory, 'resources/README.md')), await readFile('README.md'));
for (const name of ['icon.png', 'icon.ico']) assert.deepEqual(await readFile(path.join(directory, 'resources/icons', name)), await readFile(path.join('build/icons', name)));
const resources = await readdir(path.join(directory, 'resources'));
assert.equal(resources.includes('python') || resources.includes('model-cache') || resources.includes('detector') || resources.includes('Setup Detector.ps1'), false);
async function checkRuntime(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.equal(/(?:\.safetensors$|^spm\.model$|cuda.*\.dll$|cudnn.*\.dll$|cublas.*\.dll$|^python\.exe$|^pip$|^hf_xet$|^protoc\.exe$)/i.test(entry.name), false, entry.name);
    if (entry.isDirectory()) await checkRuntime(path.join(directory, entry.name));
  }
}
await checkRuntime(runtime);
await stat(path.join(directory, 'resources/docs/WINDOWS.md'));
console.log('PASS: code/icons match source, standalone CPU detector is outside ASAR, no model weights/CUDA/system Python/setup helper/developer discovery shipped.');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.PROOFGPT_DEV_URL;
const app = await electron.launch({ executablePath: path.join(directory, 'ProofGPT.exe'), args: [`--user-data-dir=${await createTestProfile('window-controls')}`], env });
let closed = false;
try {
  const page = await app.firstWindow();
  await page.getByRole('heading', { name: 'Detect AI-Generated Text' }).waitFor();
  await page.getByRole('button', { name: 'Maximize or restore window', exact: true }).click();
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), true);
  await page.getByRole('button', { name: 'Maximize or restore window', exact: true }).click();
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()), false);
  await page.getByRole('button', { name: 'Minimize window', exact: true }).click();
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()), true);
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.restore(); window.focus(); });
  const exit = new Promise((resolve) => app.process().once('exit', resolve));
  await page.getByRole('button', { name: 'Close window', exact: true }).click();
  assert.equal(await exit, 0); closed = true;
  console.log('PASS: packaged maximize, restore, minimize and close controls.');
} finally { if (!closed) await app.close(); }
