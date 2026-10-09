import { spawnSync } from 'node:child_process';
import path from 'node:path';

function run(executable, args) {
  const result = spawnSync(executable, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const npmCLI = process.env.npm_execpath;
if (!npmCLI) throw new Error('Run these checks with npm test.');
for (const task of ['build', 'lint', 'check:syntax']) run(process.execPath, [npmCLI, 'run', task]);
const python = process.env.PROOFGPT_PYTHON || path.resolve('.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
run(python, ['-m', 'py_compile', 'detector/detector.py']);
run(python, ['-m', 'pip', 'check']);
run(python, ['-m', 'unittest', 'detector.tests.test_detector', 'detector.tests.test_model_cache', '-v']);
run(process.execPath, ['scripts/python-discovery-check.cjs']);
run(process.execPath, ['scripts/detector-client-check.cjs']);
run(process.execPath, ['scripts/model-manager-check.cjs']);
for (const task of ['test:smoke', 'test:detector', 'test:history', 'test:reports', 'test:settings', 'test:help']) run(process.execPath, [npmCLI, 'run', task]);
console.log('PASS: all ProofGPT source regression checks. Packaged release verification is npm run test:release after packaging.');
