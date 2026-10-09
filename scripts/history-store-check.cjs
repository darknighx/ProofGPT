const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { HistoryStore } = require('../electron/history-store.cjs');

async function main() {
  const root = path.resolve('artifacts/test-profiles');
  await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, 'history-store-'));
  const file = path.join(directory, 'history.json');
  const results = JSON.parse(await fs.readFile('detector/tests/RESULTS.json', 'utf8'));
  const samples = JSON.parse(await fs.readFile('detector/tests/fixtures/samples.json', 'utf8'));
  // Unit-test fixture from real model output; never placed in the user's profile.
  function record(index, date) {
    const result = results.samples[index]; const text = samples[index].text;
    return { ...result, id: randomUUID(), text, preview: text.trim().replace(/\s+/g, ' ').slice(0, 160), analyzedAt: date };
  }
  const old = record(0, '2026-10-01T01:00:00.000Z');
  const newest = record(2, '2026-10-04T01:00:00.000Z');
  const store = new HistoryStore(file);
  assert.deepEqual(await store.list(), []);
  await Promise.all([store.add(old), store.add(newest)]);
  await store.add(newest);
  assert.deepEqual((await store.list()).map((item) => item.id), [newest.id, old.id]);
  assert.deepEqual(await new HistoryStore(file).list(), await store.list());
  await assert.rejects(store.add({ ...newest, characterCount: 1 }), /invalid/);
  await store.remove(old.id);
  assert.equal((await new HistoryStore(file).list()).length, 1);
  await store.clear();
  assert.deepEqual(await new HistoryStore(file).list(), []);
  for (const damaged of ['{damaged existing history', 'null', '{"version":2,"records":[]}']) {
    await fs.writeFile(file, damaged);
    await assert.rejects(store.list(), /preserved/);
    await assert.rejects(store.add(old), /preserved/);
    await assert.rejects(store.clear(), /preserved/);
    assert.equal(await fs.readFile(file, 'utf8'), damaged);
  }
  console.log('PASS: empty store, serialized writes, deduplication, newest-first, disk reload, delete/clear persistence, damaged-file preservation.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
