const { spawn } = require('node:child_process');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { stat } = require('node:fs/promises');
const manifest = require('../shared/model-manifest.json');
const totalBytes = manifest.files.reduce((total, file) => total + file.size, 0);
const unavailable = (error) => ({ ok: false, error });
const engineError = "ProofGPT's detection engine could not be started. Try reinstalling ProofGPT.";

function validProgress(message) {
  return message.totalBytes === totalBytes && Number.isSafeInteger(message.downloadedBytes) && message.downloadedBytes >= 0 && message.downloadedBytes <= totalBytes
    && Number.isFinite(message.percentage) && message.percentage >= 0 && message.percentage <= 100 && Math.abs(message.percentage - message.downloadedBytes / totalBytes * 100) < .02
    && Number.isFinite(message.bytesPerSecond) && message.bytesPerSecond >= 0;
}
function validModel(model) { return model?.name === manifest.model && model.revision === manifest.revision && model.cachedBytes === totalBytes; }

function validResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  const probability = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  return probability(result.aiProbability) && probability(result.humanProbability)
    && Math.abs(result.aiProbability + result.humanProbability - 100) < 0.02
    && ['AI Likely', 'Human Likely', 'Mixed / Uncertain'].includes(result.classification)
    && ['Low', 'Moderate', 'High'].includes(result.confidence)
    && ['wordCount', 'characterCount', 'sentenceCount', 'chunksAnalyzed'].every((key) => Number.isInteger(result[key]) && result[key] > 0)
    && result.modelName === 'ShantanuT01/dactyl-ai-text-detector'
    && result.detectorVersion === 'dactyl-ml-v1' && typeof result.modelRevision === 'string'
    && typeof result.inferenceDurationMs === 'number' && Number.isFinite(result.inferenceDurationMs) && result.inferenceDurationMs >= 0
    && Array.isArray(result.observations) && result.observations.length <= 4 && result.observations.every((item) => typeof item === 'string')
    && Array.isArray(result.chunks) && result.chunks.length === result.chunksAnalyzed
    && result.chunks.every((chunk, index) => chunk && typeof chunk === 'object' && probability(chunk.aiProbability) && Number.isInteger(chunk.tokenCount) && chunk.tokenCount > 0
      && Number.isInteger(chunk.tokenStart) && Number.isInteger(chunk.tokenEnd) && chunk.tokenEnd - chunk.tokenStart === chunk.tokenCount
      && chunk.tokenStart === (index ? result.chunks[index - 1].tokenEnd : 0)
      && Number.isInteger(chunk.startCharacter) && Number.isInteger(chunk.endCharacter) && chunk.startCharacter >= 0
      && chunk.endCharacter >= chunk.startCharacter && chunk.endCharacter <= result.characterCount);
}

class DetectorClient {
  constructor({ root, diagnostics = false, pythonPath, cacheDirectory, bundledExecutable }) {
    this.root = root; this.diagnostics = diagnostics; this.pythonPath = pythonPath; this.cacheDirectory = cacheDirectory;
    this.bundledExecutable = bundledExecutable;
    this.child = null; this.pending = null;
  }
  async start(pending) {
    let executable, args;
    const env = { ...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_TELEMETRY: '1', PROOFGPT_DIAGNOSTICS: this.diagnostics ? '1' : '0' };
    if (this.bundledExecutable) {
      // Production never imports discovery tooling or falls back to PATH/registry.
      if (!(await stat(this.bundledExecutable)).isFile()) throw new Error(engineError);
      executable = this.bundledExecutable; args = [];
      delete env.PROOFGPT_PYTHON; delete env.PYTHONHOME; delete env.PYTHONPATH;
      env.HF_HOME = this.cacheDirectory;
      env.HF_HUB_CACHE = path.join(this.cacheDirectory, 'hub');
      env.HF_XET_CACHE = path.join(this.cacheDirectory, 'xet');
      env.HF_ASSETS_CACHE = path.join(this.cacheDirectory, 'assets');
      delete env.TRANSFORMERS_CACHE;
      delete env.PYTORCH_TRANSFORMERS_CACHE; delete env.PYTORCH_PRETRAINED_BERT_CACHE;
      env.HF_HUB_DISABLE_IMPLICIT_TOKEN = '1';
      env.HF_ENDPOINT = 'https://huggingface.co';
      env.HF_HUB_ENABLE_HF_TRANSFER = '0';
      // Use the Hub's standard resumable HTTP transfer in the Windows bundle.
      // The optional native Xet transfer stalled during first-use verification.
      env.HF_HUB_DISABLE_XET = '1';
    } else {
      // Developer-only module is excluded from the production ASAR.
      const { discoverPython, checkDependencies } = require('./python-discovery.cjs');
      const options = { env: process.env, diagnostics: this.diagnostics, signal: pending.controller.signal };
      const selected = await discoverPython({ ...options, root: this.root, preferredPath: this.pythonPath });
      if (this.pending !== pending) return;
      pending.onStatus({ phase: 'loading', message: 'Checking local detector dependencies...' });
      await checkDependencies(selected, { ...options, cwd: this.root });
      this.selectedPython = selected;
      executable = selected.executable; args = ['-u', path.join(this.root, 'detector/detector.py')];
      if (this.cacheDirectory && !env.HF_HOME) env.HF_HOME = this.cacheDirectory;
    }
    if (this.pending !== pending) return;
    const child = spawn(executable, args, {
      cwd: this.root, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });
    this.child = child;
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data) => {
      if (this.child !== child) return;
      buffer += data;
      if (buffer.length > 2_000_000) return this.stop('Detection unavailable: the detector response was too large.');
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        let message;
        try { message = JSON.parse(line); } catch { return this.stop('Detection unavailable: the detector returned malformed output.'); }
        if (!message || typeof message !== 'object' || Array.isArray(message)) return this.stop('Detection unavailable: the detector returned an invalid response.');
        const pending = this.pending;
        if (!pending || message.id !== pending.id) continue;
        if (message.type === 'status' && ['loading', 'downloading', 'analyzing'].includes(message.phase) && typeof message.message === 'string') {
          this.updateTimeout(pending, message.phase);
          pending.onStatus({ phase: message.phase, message: message.message.slice(0, 300) });
          if (this.diagnostics) console.info('[detector]', message.message);
        } else if (message.type === 'error' && typeof message.message === 'string') {
          this.finish({ ...unavailable(this.bundledExecutable && ['DEPENDENCIES', 'INTERNAL'].includes(message.code) ? engineError : message.message.slice(0, 500)), code: message.code });
        } else if (message.type === 'download_progress' && validProgress(message)) {
          this.updateTimeout(pending, 'downloading');
          pending.onStatus({ phase: 'downloading', message: 'Downloading detection model...', progress: {
            downloadedBytes: message.downloadedBytes, totalBytes, percentage: message.percentage, bytesPerSecond: message.bytesPerSecond,
          } });
        } else if (message.type === 'model_ready' && pending.method === 'download_model' && validModel(message.model)) {
          this.finish({ ok: true, model: message.model });
        } else if (message.type === 'result' && pending.method === 'analyze' && validResult(message.result) && message.result.characterCount === pending.characterCount) {
          this.finish({ ok: true, result: message.result });
        } else this.stop('Detection unavailable: the detector returned an invalid result.');
      }
    });
    child.stderr.on('data', (data) => { if (this.diagnostics) process.stderr.write(data); });
    child.stdin.on('error', () => { if (this.child === child) this.stop(this.bundledExecutable ? engineError : 'Detection unavailable: communication with the developer detector failed. Please try again.'); });
    child.on('error', () => {
      if (this.child === child) this.stop(this.startError());
    });
    child.on('exit', () => {
      if (this.child === child) { this.child = null; this.finish(unavailable(this.bundledExecutable ? engineError : 'Detection unavailable: the developer detector stopped. Check dependencies and available memory, then try again.')); }
    });
  }
  analyze(text, onStatus = () => {}) {
    if (typeof text !== 'string' || !text.trim() || text.length > 15000) return Promise.resolve(unavailable('Enter valid text within 15,000 characters.'));
    return this.request('analyze', { text }, onStatus);
  }
  downloadModel(onStatus = () => {}, repair = false) {
    return this.request('download_model', { repair }, onStatus);
  }
  updateTimeout(pending, phase) {
    if (phase === 'downloading' && !pending.downloading) {
      clearTimeout(pending.timer); pending.downloading = true;
      pending.timer = setTimeout(() => this.stop('The detection model download timed out. Check your connection and try again.'), 90 * 60_000);
    } else if (phase !== 'downloading' && pending.downloading) {
      clearTimeout(pending.timer); pending.downloading = false;
      pending.timer = setTimeout(() => this.stop('Detection unavailable: the detector timed out. Check available memory and retry.'), 20 * 60_000);
    }
  }
  request(method, payload, onStatus) {
    if (this.pending) return Promise.resolve(unavailable('An analysis is already in progress.'));
    return new Promise((resolve) => {
      const id = randomUUID();
      const timer = setTimeout(() => this.stop('Detection unavailable: the detector timed out. Check your connection and retry.'), 20 * 60_000);
      const pending = { id, method, resolve, onStatus, timer, characterCount: payload.text?.length, controller: new AbortController() };
      this.pending = pending;
      void (async () => {
        try {
          onStatus({ phase: 'loading', message: 'Preparing local detector...' });
          if (!this.child) await this.start(pending);
          if (this.pending === pending && this.child) this.child.stdin.write(JSON.stringify({ id, method, ...payload }) + '\n');
        } catch (error) {
          if (this.pending === pending) this.stop(!this.bundledExecutable && error.name === 'PythonSetupError' ? error.message : this.startError());
        }
      })();
    });
  }
  startError() {
    return this.bundledExecutable ? engineError : 'Detection unavailable: the detected Python interpreter could not start. Check the developer Python installation and detector dependencies, then try again.';
  }
  finish(response) {
    if (!this.pending) return;
    const { timer, resolve, controller } = this.pending;
    clearTimeout(timer); this.pending = null; resolve(response);
    controller.abort();
  }
  stop(message = 'Detection cancelled because ProofGPT is closing.') {
    const child = this.child; this.child = null;
    if (child) child.kill();
    this.finish(unavailable(message));
  }
}
module.exports = { DetectorClient, validResult, validProgress };
