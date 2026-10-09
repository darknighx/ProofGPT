const assert = require('node:assert/strict');
const { mkdir, writeFile, mkdtemp } = require('node:fs/promises');
const path = require('node:path');
const { ModelManager } = require('../electron/model-manager.cjs');
const { validProgress } = require('../electron/detector-client.cjs');
const manifest = require('../shared/model-manifest.json');
const total = manifest.files.reduce((sum, file) => sum + file.size, 0);

async function main() {
  const base = path.resolve('artifacts/test-profiles'); await mkdir(base, { recursive: true });
  const cache = await mkdtemp(path.join(base, 'manager-'));
  let starts = 0, analyses = 0, finish, status;
  const client = {
    downloadModel: (callback) => { starts++; status = callback; return new Promise((resolve) => { finish = resolve; }); },
    analyze: async () => { analyses++; return { ok: true, result: {} }; },
  };
  const manager = new ModelManager({ client, cacheDirectory: cache });
  assert.equal((await manager.status()).status, 'not-downloaded');
  const first = manager.download(), duplicate = manager.download();
  assert.equal(first, duplicate);
  await new Promise(setImmediate);
  const analysis = manager.analyze('word '.repeat(50), () => {});
  const progress = { downloadedBytes: 740000000, totalBytes: total, percentage: Math.round(740000000 / total * 10000) / 100, bytesPerSecond: 11800000 };
  assert.equal(validProgress(progress), true);
  assert.equal(validProgress({ ...progress, bytesPerSecond: NaN }), false);
  assert.equal(validProgress({ ...progress, downloadedBytes: total + 1 }), false);
  status({ phase: 'downloading', progress });
  assert.equal(manager.getState().progress.downloadedBytes, 740000000);
  assert.equal(starts, 1); assert.equal(analyses, 0);
  finish({ ok: true });
  await Promise.all([first, analysis]);
  assert.equal(starts, 1); assert.equal(analyses, 1);
  assert.equal(manager.getState().status, 'ready'); assert.equal(manager.getState().progress, null);
  await manager.download(); assert.equal(starts, 1);
  client.analyze = async (_text, callback) => {
    callback({ phase: 'downloading', progress: { downloadedBytes: total, totalBytes: total, percentage: 100, bytesPerSecond: 0 } });
    callback({ phase: 'loading', message: 'Loading detection model...' });
    assert.equal(manager.getState().progress, null);
    assert.equal(manager.getState().status, 'ready');
    return { ok: true };
  };
  await manager.analyze('word '.repeat(50));
  client.analyze = async (_text, callback) => {
    callback({ phase: 'downloading', progress });
    return { ok: false, code: 'MODEL_DOWNLOAD', error: 'Interrupted.' };
  };
  await manager.analyze('word '.repeat(50));
  assert.equal(manager.getState().status, 'failed'); assert.equal(manager.getState().progress, null);

  const folder = path.join(cache, 'hub', `models--${manifest.model.replaceAll('/', '--')}`, 'snapshots', manifest.revision);
  await mkdir(folder, { recursive: true });
  // Temporary sized test files validate the local check without using model data.
  const { open } = require('node:fs/promises');
  for (const file of manifest.files) { const handle = await open(path.join(folder, file.name), 'w'); await handle.truncate(file.size); await handle.close(); }
  const cached = new ModelManager({ client, cacheDirectory: cache });
  assert.equal((await cached.status()).status, 'ready');
  await writeFile(path.join(folder, 'model.safetensors'), 'truncated');
  const partial = new ModelManager({ client, cacheDirectory: cache });
  assert.equal((await partial.status()).status, 'not-downloaded');
  const retry = partial.download(); await new Promise(setImmediate); finish({ ok: false, error: 'Connection interrupted.' });
  await retry; assert.equal(partial.getState().status, 'failed'); assert.equal(partial.getState().progress, null);
  const resumed = partial.download(); await new Promise(setImmediate); finish({ ok: true }); await resumed;
  assert.equal(partial.getState().status, 'ready');
  console.log('PASS: one shared download, queued analysis, validated byte progress, offline cached check, truncated rejection and retry.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
