const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const PROBE_MARKER = 'PROOFGPT_PYTHON:';
const INFO_CODE = 'import sys,struct,json; print("PROOFGPT_PYTHON:"+json.dumps({"executable":sys.executable,"version":list(sys.version_info[:3]),"bits":struct.calcsize("P")*8}))';
const DEPENDENCY_CODE = `import sys,struct,json,importlib
modules = ["torch", "transformers", "huggingface_hub", "sentencepiece", "google.protobuf", "numpy", "hf_xet"]
errors = []
versions = {}
for name in modules:
    try:
        module = importlib.import_module(name)
        versions[name] = str(getattr(module, "__version__", "installed"))
    except Exception as error:
        errors.append({"module":name,"reason":type(error).__name__})
try:
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    from huggingface_hub import snapshot_download
except Exception as error:
    errors.append({"module":"detector imports","reason":type(error).__name__})
print("PROOFGPT_PYTHON:"+json.dumps({"executable":sys.executable,"version":list(sys.version_info[:3]),"bits":struct.calcsize("P")*8,"errors":errors,"versions":versions}))`;

class PythonSetupError extends Error {
  constructor(code, message) { super(message); this.name = 'PythonSetupError'; this.code = code; }
}
const notFound = () => new PythonSetupError('PYTHON_NOT_FOUND', 'The developer checkout requires 64-bit Python 3.11 or 3.12. Python could not be detected. Check Development in README or PROOFGPT_PYTHON.');
const missingDependencies = () => new PythonSetupError('DEPENDENCIES', 'Python detected, but ProofGPT detector dependencies are not installed or cannot load. Follow Development in README to prepare the selected Python environment.');

// Fixed probe programs only. Submitted analysis text never enters these arguments.
function runProbe(command, args, { env = process.env, cwd, timeout = 5000, signal } = {}) {
  return new Promise((resolve) => {
    let output = '', failure;
    const child = spawn(command, args, { cwd, env: { ...env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_TELEMETRY: '1' }, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'], signal });
    const timer = setTimeout(() => { failure = 'probe timed out'; child.kill(); }, timeout);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      if (output.length + data.length > 64_000) { failure = 'invalid oversized probe response'; child.kill(); }
      else output += data;
    });
    child.on('error', (error) => { failure = error.code === 'ENOENT' ? 'command not found' : error.code === 'ABORT_ERR' ? 'probe cancelled' : `could not execute (${error.code || 'unknown error'})`; });
    child.on('close', (code) => { clearTimeout(timer); resolve({ output, reason: failure || (code !== 0 ? `process exited with code ${code}` : null) }); });
  });
}
function probeInfo(output) {
  const lines = output.split(/\r?\n/).filter((line) => line.startsWith(PROBE_MARKER));
  if (lines.length !== 1) return null;
  try { return JSON.parse(lines[0].slice(PROBE_MARKER.length)); } catch { return null; }
}
function incompatibility(info, platform) {
  if (!info || typeof info.executable !== 'string' || !(platform === 'win32' ? path.win32 : path.posix).isAbsolute(info.executable)
    || !Array.isArray(info.version) || info.version.length !== 3 || !info.version.every((value) => Number.isInteger(value) && value >= 0)) return 'no valid Python version response (possibly an inactive Windows Store alias)';
  if (info.version[0] !== 3 || ![11, 12].includes(info.version[1])) return `unsupported Python ${info.version.join('.')}; need 3.11 or 3.12`;
  if (info.bits !== 64) return `unsupported architecture ${info.bits}-bit; need 64-bit`;
  return null;
}
function environmentValue(env, name) {
  return Object.entries(env).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}
function expandEnvironment(value, env) {
  return value.replace(/%([^%]+)%/g, (match, name) => environmentValue(env, name) || match);
}
async function windowsCandidates({ env, run, signal }) {
  const candidates = [];
  const add = (command, args = [], source = 'Windows installation') => { if (command) candidates.push({ command, args, source }); };
  const system = environmentValue(env, 'SystemRoot');
  const local = environmentValue(env, 'LOCALAPPDATA');
  const reg = system ? path.win32.join(system, 'System32', 'reg.exe') : 'reg.exe';
  for (const hive of ['HKCU', 'HKLM']) {
    for (const view of ['64', '32']) {
      signal?.throwIfAborted();
      const result = await run(reg, ['query', `${hive}\\Software\\Python\\PythonCore`, '/s', `/reg:${view}`], { env, timeout: 3000, signal });
      let installation = false;
      for (const line of result.output.split(/\r?\n/)) {
        if (/^HKEY_/.test(line)) installation = /\\PythonCore\\3\.(?:11|12)(?:[-\w.]*)\\InstallPath\s*$/i.test(line);
        if (!installation) continue;
        const value = line.match(/^\s+(.+?)\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/);
        if (value && value[1] === 'ExecutablePath') add(expandEnvironment(value[2], env), [], 'Windows registry');
        else if (value && value[1] === '(Default)') add(path.win32.join(expandEnvironment(value[2], env), 'python.exe'), [], 'Windows registry');
      }
    }
  }
  for (const launcher of [system && path.win32.join(system, 'py.exe'), local && path.win32.join(local, 'Programs', 'Python', 'Launcher', 'py.exe')]) {
    if (launcher) for (const selector of ['-3.11', '-3.12']) add(launcher, [selector], 'Windows launcher path');
  }
  // An app launched before PATH was updated can still find registered Store aliases.
  if (local) for (const name of ['python.exe', 'python3.exe']) add(path.win32.join(local, 'Microsoft', 'WindowsApps', name), [], 'Windows alias path');
  const drive = environmentValue(env, 'SystemDrive');
  for (const directory of [local && path.win32.join(local, 'Programs', 'Python'), environmentValue(env, 'ProgramFiles'), environmentValue(env, 'ProgramFiles(x86)'), drive && `${drive}\\`]) {
    if (directory) for (const version of ['Python311', 'Python312']) add(path.win32.join(directory, version, 'python.exe'));
  }
  return candidates;
}

async function discoverPython({ root, preferredPath, env = process.env, platform = process.platform, diagnostics = false, signal,
  run = runProbe, log = (value) => console.info('[python]', value) }) {
  const report = (value) => { if (diagnostics) log(value); };
  const explicit = env.PROOFGPT_PYTHON;
  const candidates = explicit ? [{ command: explicit, args: [], source: 'PROOFGPT_PYTHON' }] : [];
  if (!explicit) {
    const local = path.join(root, '.venv', platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    if (preferredPath && existsSync(preferredPath)) candidates.push({ command: preferredPath, args: [], source: 'prepared environment' });
    if (existsSync(local)) candidates.push({ command: local, args: [], source: 'project environment' });
    candidates.push({ command: 'python', args: [], source: 'PATH' });
    if (platform === 'win32') for (const args of [['-3.11'], ['-3.12'], []]) candidates.push({ command: 'py', args, source: 'Python launcher' });
    candidates.push({ command: 'python3', args: [], source: 'PATH' });
  }
  const checked = new Set();
  const inspect = async (candidate) => {
    const key = JSON.stringify([platform === 'win32' ? candidate.command.toLowerCase() : candidate.command, candidate.args]);
    if (checked.has(key)) return null;
    checked.add(key); signal?.throwIfAborted();
    report({ candidate: candidate.command, arguments: candidate.args, source: candidate.source });
    const result = await run(candidate.command, [...candidate.args, '-c', INFO_CODE], { env, cwd: root, signal });
    signal?.throwIfAborted();
    const info = probeInfo(result.output);
    const reason = result.reason || incompatibility(info, platform);
    report({ candidate: candidate.command, executable: info?.executable, version: info?.version?.join?.('.'), architecture: info?.bits, ...(reason ? { rejected: reason } : { accepted: true }) });
    return reason ? null : { ...info, source: candidate.source };
  };
  let selected;
  for (const candidate of candidates) { selected = await inspect(candidate); if (selected) break; }
  if (!selected && !explicit && platform === 'win32') {
    for (const candidate of await windowsCandidates({ env, run, signal })) { selected = await inspect(candidate); if (selected) break; }
  }
  if (!selected && explicit) throw new PythonSetupError('PYTHON_OVERRIDE_INVALID', 'Detection unavailable: the Python executable configured by PROOFGPT_PYTHON is missing, incompatible, or cannot start. Choose 64-bit Python 3.11 or 3.12, or remove this override to enable automatic detection.');
  if (!selected) throw notFound();
  return selected;
}

async function checkDependencies(selected, { env = process.env, cwd, signal, diagnostics = false, run = runProbe, log = (value) => console.info('[python]', value) } = {}) {
  // Re-query the exact executable before launching the worker, not the launcher's default Python.
  const result = await run(selected.executable, ['-c', DEPENDENCY_CODE], { env, cwd, timeout: 60000, signal });
  signal?.throwIfAborted();
  const info = probeInfo(result.output);
  const reason = result.reason || incompatibility(info, process.platform);
  if (diagnostics) log({ executable: selected.executable, version: info?.version?.join?.('.'), architecture: info?.bits, dependencyErrors: info?.errors, rejected: reason || undefined });
  if (reason) throw new PythonSetupError('PYTHON_LAUNCH_FAILED', 'Detection unavailable: the detected Python interpreter could not start. Check the selected Python installation, then try again.');
  const samePath = process.platform === 'win32' ? info.executable.toLowerCase() === selected.executable.toLowerCase() : info.executable === selected.executable;
  if (!samePath || info.version.join('.') !== selected.version.join('.') || info.bits !== selected.bits) throw new PythonSetupError('PYTHON_LAUNCH_FAILED', 'Detection unavailable: the selected Python interpreter changed. Restart ProofGPT and check your Python installation.');
  if (!Array.isArray(info.errors) || info.errors.length) throw missingDependencies();
  return info;
}

module.exports = { discoverPython, checkDependencies, runProbe, PythonSetupError, INFO_CODE, DEPENDENCY_CODE };
