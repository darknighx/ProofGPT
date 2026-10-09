const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { SettingsStore, defaults } = require('../electron/settings-store.cjs');

async function main() {
  const root = path.resolve('artifacts/test-profiles');
  await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, 'settings-store-'));
  const file = path.join(directory, 'settings.json');
  const store = new SettingsStore(file);
  assert.deepEqual(await store.get(), defaults);
  await Promise.all([store.update({ saveHistory: false }), store.update({ defaultExportFormat: 'json' }), store.update({ startPage: 'reports' })]);
  const saved = await new SettingsStore(file).get();
  assert.equal(saved.saveHistory, false); assert.equal(saved.defaultExportFormat, 'json'); assert.equal(saved.startPage, 'reports');
  for (const patch of [{ theme: 'light' }, { saveHistory: 'false' }, { startPage: 'help' }, { defaultExportFormat: 'pdf' }, { unknown: true }, null, []]) {
    await assert.rejects(store.update(patch), /not supported/);
  }
  assert.deepEqual(await store.get(), saved);
  const untouched = path.join(directory, 'history.json');
  await fs.writeFile(untouched, 'existing history sentinel');
  await store.restoreDefaults();
  assert.deepEqual(await new SettingsStore(file).get(), defaults);
  assert.equal(await fs.readFile(untouched, 'utf8'), 'existing history sentinel');
  for (const damaged of ['{broken settings', 'null', '{"version":2,"settings":{}}']) {
    await fs.writeFile(file, damaged);
    await assert.rejects(store.get(), /preserved/);
    await assert.rejects(store.update({ saveHistory: true }), /preserved/);
    assert.equal(await fs.readFile(file, 'utf8'), damaged);
    await store.restoreDefaults();
    assert.deepEqual(await store.get(), defaults);
  }
  const blocked = new SettingsStore(path.join(directory, 'history.json', 'settings.json'));
  await assert.rejects(blocked.restoreDefaults(), /could not be saved/);
  assert.equal(await fs.readFile(untouched, 'utf8'), 'existing history sentinel');
  console.log('PASS: default settings, serialized patches, disk reload, supported values only, confirmed defaults preserve History, damaged-file preservation/recovery, write failure.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
