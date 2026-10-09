const assert = require('node:assert/strict');
const path = require('node:path');
const { mkdir, mkdtemp } = require('node:fs/promises');
const { discoverPython, checkDependencies, PythonSetupError } = require('../electron/python-discovery.cjs');

const executable = 'C:\\Python installation\\python.exe';
const info = (version = [3, 11, 9], bits = 64, extra = {}) => ({ executable, version, bits, ...extra });
const response = (value) => ({ output: `PROOFGPT_PYTHON:${JSON.stringify(value)}\n`, reason: null });
async function main() {
  await mkdir('artifacts/test-profiles', { recursive: true });
  const root = await mkdtemp(path.resolve('artifacts/test-profiles/python-discovery-'));
  function fixture(table) {
    const calls = [], logs = [];
    const run = async (command, args, options) => {
      calls.push({ command, args, options });
      if (command === executable && args.at(-1).includes('modules =')) return response(table.dependencies || info([3, 11, 9], 64, { errors: [], versions: {} }));
      return table[JSON.stringify([command, args.slice(0, -2)])] || { output: '', reason: 'command not found' };
    };
    return { calls, logs, run, options: { root, env: {}, platform: 'win32', run, diagnostics: true, log: (value) => logs.push(value) } };
  }
  const command = (name, args = []) => JSON.stringify([name, args]);
  let test = fixture({ [command('python')]: response(info()) });
  let selected = await discoverPython(test.options);
  assert.equal(selected.executable, executable);
  await checkDependencies(selected, { run: test.run });
  assert.deepEqual(test.calls.map(({ command }) => command), ['python', executable]);
  assert.ok(test.logs.some((entry) => entry.accepted && entry.version === '3.11.9' && entry.architecture === 64));

  test = fixture({ [command('python')]: { output: 'Python was not found; Windows Store alias.', reason: null }, [command('py', ['-3.11'])]: response(info()) });
  selected = await discoverPython(test.options);
  await checkDependencies(selected, { run: test.run });
  assert.deepEqual(test.calls[1].args.slice(0, 2), ['-3.11', '-c']);
  assert.equal(test.calls.at(-1).command, executable);
  assert.ok(test.logs.some((entry) => /Store alias/.test(entry.rejected || '')));

  test = fixture({ [command('python')]: response(info([3, 13, 0])), [command('py', ['-3.11'])]: response(info([3, 11, 9], 32)), [command('py', ['-3.12'])]: response(info([3, 12, 14])) });
  selected = await discoverPython(test.options);
  assert.deepEqual(selected.version, [3, 12, 14]);
  assert.ok(test.logs.some((entry) => /unsupported Python/.test(entry.rejected || '')));
  assert.ok(test.logs.some((entry) => /32-bit/.test(entry.rejected || '')));

  test = fixture({ [command('python')]: response(info()), dependencies: info([3, 11, 9], 64, { errors: [{ module: 'torch', reason: 'ModuleNotFoundError' }] }) });
  selected = await discoverPython(test.options);
  await assert.rejects(checkDependencies(selected, { run: test.run }), (error) => error instanceof PythonSetupError && error.code === 'DEPENDENCIES' && /Python detected.*dependencies/.test(error.message));

  test = fixture({ [command('python')]: response(info([3, 10, 11])), [command('py', ['-3.11'])]: response(info([3, 11, 9], 32)) });
  await assert.rejects(discoverPython(test.options), (error) => error.code === 'PYTHON_NOT_FOUND' && /64-bit Python 3.11 or 3.12.*could not be detected/.test(error.message));

  test = fixture({ [command('python')]: response(info()) });
  await assert.rejects(discoverPython({ ...test.options, env: { PROOFGPT_PYTHON: 'C:\\not-installed\\python.exe' } }), (error) => error.code === 'PYTHON_OVERRIDE_INVALID' && /configured by PROOFGPT_PYTHON/.test(error.message));
  assert.equal(test.calls.length, 1, 'An explicit interpreter override must not silently select a different environment.');

  test = fixture({ [command('python3')]: response(info()) });
  selected = await discoverPython(test.options);
  assert.equal(selected.executable, executable);
  test = fixture({ [command(executable)]: response(info()) });
  const run = test.run;
  test.options.run = async (name, args, options) => /reg\.exe$/i.test(name)
    ? { reason: null, output: `HKEY_CURRENT_USER\\Software\\Python\\PythonCore\\3.11\\InstallPath\n    ExecutablePath    REG_SZ    ${executable}\n` }
    : run(name, args, options);
  selected = await discoverPython(test.options);
  assert.equal(selected.source, 'Windows registry');

  test = fixture({ [command('python')]: response(info()) });
  await discoverPython({ ...test.options, diagnostics: false });
  assert.equal(test.logs.length, 0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(discoverPython({ ...test.options, signal: controller.signal }), { name: 'AbortError' });
  console.log('PASS: python, py -3.11/-3.12, python3, registry paths/spaces, inactive Store aliases, version/64-bit rejection, same executable dependency check, distinct dependency/missing-Python errors, explicit override, cancellation, quiet production logs.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
