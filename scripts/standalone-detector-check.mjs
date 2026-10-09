import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const executable = path.resolve('detector/dist/proofgpt-detector/ProofGPTDetector.exe');
const env = { ...process.env, PATH: path.join(process.env.SystemRoot, 'System32'), PYTHONHOME: '', PYTHONPATH: '',
  HF_HOME: path.resolve('.model-cache'), HF_HUB_CACHE: path.resolve('.model-cache/hub'), HF_HUB_OFFLINE: '1',
  HTTP_PROXY: 'http://127.0.0.1:9', HTTPS_PROXY: 'http://127.0.0.1:9', ALL_PROXY: 'http://127.0.0.1:9', PROOFGPT_DIAGNOSTICS: '1' };
for (const command of ['python', 'python3', 'py', 'pip']) assert.equal(spawnSync(command, ['--version'], { env, shell: false, windowsHide: true }).error?.code, 'ENOENT');
const samples = JSON.parse(await readFile('detector/tests/fixtures/samples.json', 'utf8'));
const expected = JSON.parse(await readFile('detector/tests/RESULTS.json', 'utf8')).samples;
const child = spawn(executable, [], { env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
const statuses = [], results = []; let buffer = '', resolve, reject;
const timer = setTimeout(() => { child.kill(); reject?.(new Error('Standalone inference timed out')); }, 180000);
child.stderr.on('data', (data) => process.stderr.write(data));
child.on('error', (error) => reject?.(error));
child.stdout.on('data', (data) => {
  buffer += data;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const message = JSON.parse(buffer.slice(0, newline)); buffer = buffer.slice(newline + 1);
    if (message.type === 'status') statuses.push(message);
    if (message.type === 'error') reject?.(new Error(JSON.stringify(message)));
    if (message.type === 'result') { results.push(message.result); resolve?.(message.result); }
  }
});
try {
  for (const sample of [samples[0], samples[3]]) {
    const result = await new Promise((res, rej) => { resolve = res; reject = rej; child.stdin.write(JSON.stringify({ id: sample.id, method: 'analyze', text: sample.text }) + '\n'); });
    const baseline = expected.find((entry) => entry.id === sample.id);
    assert.equal(result.aiProbability, baseline.aiProbability);
    assert.deepEqual(result.chunks, baseline.chunks);
    assert.equal(result.classification, baseline.classification);
    assert.equal(result.confidence, baseline.confidence);
    assert.equal(result.modelRevision, 'b62b403cb6c5c14751b5b98b474e5f662b41cef9');
  }
  assert.equal(statuses.some((status) => status.phase === 'downloading'), false);
  await writeFile('artifacts/standalone-regression.json', JSON.stringify({ executable, pythonUnavailable: true, offline: true, results, statuses }, null, 2));
  console.log('PASS: standalone bundled detector, Python/python3/py/pip unavailable, offline cached AI/human inference exactly matches source scores.');
} finally { clearTimeout(timer); child.kill(); }
