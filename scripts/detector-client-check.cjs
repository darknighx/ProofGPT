const assert = require('node:assert/strict');
const path = require('node:path');
const { DetectorClient, validResult } = require('../electron/detector-client.cjs');
async function main() {
  const root = path.resolve(__dirname, '..');
  const fixture = path.join(root, 'detector/tests/bridge-fixture');
  const previous = process.env.PROOFGPT_PYTHON;
  let client;
  try {
    // A missing bundled engine must not fall back even when developer Python exists.
    process.env.PROOFGPT_PYTHON = path.join(root, '.venv/Scripts/python.exe');
    client = new DetectorClient({ root, bundledExecutable: path.join(root, 'missing-engine.exe'), cacheDirectory: root });
    assert.match((await client.analyze('word '.repeat(50))).error, /engine could not be started.*reinstalling/);
    assert.equal(client.selectedPython, undefined);
    client.stop();
    process.env.PROOFGPT_PYTHON = path.join(root, 'missing-python-executable');
    client = new DetectorClient({ root });
    assert.match((await client.analyze('word '.repeat(50))).error, /configured by PROOFGPT_PYTHON/);
    client.stop();
    process.env.PROOFGPT_PYTHON = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    for (const [mode, expected] of [['crash', /stopped/], ['malformed', /malformed/], ['null-response', /invalid response/], ['array-response', /invalid response/], ['invalid-result', /invalid result/], ['error', /test inference failure/]]) {
      client = new DetectorClient({ root: fixture });
      const response = await client.analyze(mode);
      assert.equal(response.ok, false); assert.match(response.error, expected);
      if (mode === 'error') assert.equal(client.child.spawnfile, client.selectedPython.executable);
      client.stop();
    }
    client = new DetectorClient({ root: fixture });
    assert.equal((await client.analyze('crash')).ok, false);
    assert.match((await client.analyze('error')).error, /test inference failure/);
    const pending = client.analyze('hang');
    assert.match((await client.analyze('second')).error, /already in progress/);
    client.stop();
    assert.equal((await pending).ok, false);
    assert.equal(validResult({ aiProbability: NaN }), false);
    assert.equal(validResult(null), false);
    const real = require('../detector/tests/RESULTS.json').samples[0];
    assert.equal(validResult({ ...real, inferenceDurationMs: undefined }), false);
    assert.equal(validResult({ ...real, chunks: [null] }), false);
    console.log('PASS: missing Python, crash, malformed JSON/result, inference error, duplicate rejection, cancellation.');
  } finally {
    client?.stop();
    if (previous === undefined) delete process.env.PROOFGPT_PYTHON;
    else process.env.PROOFGPT_PYTHON = previous;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
