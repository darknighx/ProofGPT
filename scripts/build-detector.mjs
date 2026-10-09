import { spawn } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
const { discoverPython, checkDependencies } = createRequire(import.meta.url)('../electron/python-discovery.cjs');
const root = process.cwd();
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build the detector on Windows x64.');
const python = await discoverPython({ root, diagnostics: true });
await checkDependencies(python, { cwd: root });
function run(args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(python.executable, args, { cwd: root, shell: false, windowsHide: true,
      stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let output = '';
    if (capture) child.stdout.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(`Detector build command failed (${code}).`)));
  });
}
const environment = JSON.parse(await run(['-c', 'import json, platform, torch; print(json.dumps({"python":platform.python_version(),"torch":torch.__version__,"cuda":torch.version.cuda}))'], true));
if (environment.cuda !== null || !environment.torch.endsWith('+cpu')) throw new Error('Use CPU-only PyTorch to build the Windows detector; see Development in README.');
const installed = JSON.parse(await run(['-c', 'import json, importlib.metadata as m; from pathlib import Path; pins = [line.split("==") for line in Path("detector/requirements.txt").read_text().splitlines() if "==" in line and not line.startswith("#")]; print(json.dumps({name:m.version(name).split("+")[0] == version for name,version in pins}))'], true));
if (Object.values(installed).some((matches) => !matches)) throw new Error('Install the pinned detector/requirements.txt versions before rebuilding the runtime.');
await run(['-m', 'pip', 'install', '-r', 'detector/build-requirements.txt']);
await run(['-m', 'PyInstaller', '--noconfirm', '--distpath', 'detector/dist', '--workpath', 'detector/build', 'detector/proofgpt-detector.spec']);
const directory = path.join(root, 'detector/dist/proofgpt-detector');
await stat(path.join(directory, 'ProofGPTDetector.exe'));
const info = await new Promise((resolve, reject) => {
  const child = spawn(path.join(directory, 'ProofGPTDetector.exe'), ['--runtime-info'], { shell: false, windowsHide: true,
    env: { ...process.env, PATH: path.join(process.env.SystemRoot, 'System32'), PYTHONHOME: '', PYTHONPATH: '' }, stdio: ['ignore', 'pipe', 'inherit'] });
  let output = ''; child.stdout.on('data', (chunk) => { output += chunk; });
  child.on('error', reject);
  child.on('exit', (code) => code === 0 ? resolve(JSON.parse(output)) : reject(new Error('The standalone detector failed its isolated runtime check.')));
});
if (!info.frozen || info.bits !== 64 || info.cuda !== null || info.torch !== environment.torch) throw new Error('The bundled detector runtime does not match the CPU x64 build environment.');
await writeFile(path.join(directory, 'runtime-manifest.json'), JSON.stringify({ ...info, executable: 'ProofGPTDetector.exe',
  mode: 'onedir', pyinstaller: '6.22.3', sourceSha256: createHash('sha256').update(await readFile('detector/detector.py')).digest('hex'),
  modelCacheSha256: createHash('sha256').update(await readFile('detector/model_cache.py')).digest('hex'),
  modelManifestSha256: createHash('sha256').update(await readFile('shared/model-manifest.json')).digest('hex') }, null, 2));
console.log(`Standalone runtime verified without Python on PATH: ${directory}`);
