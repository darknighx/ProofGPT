const { EventEmitter } = require('node:events');
const { stat } = require('node:fs/promises');
const path = require('node:path');
const manifest = require('../shared/model-manifest.json');
const totalBytes = manifest.files.reduce((sum, file) => sum + file.size, 0);

class ModelManager extends EventEmitter {
  constructor({ client, cacheDirectory, hubDirectory = path.join(cacheDirectory, 'hub') }) {
    super(); this.client = client; this.cacheDirectory = cacheDirectory; this.hubDirectory = hubDirectory;
    this.downloadPromise = null; this.analysisPromise = null; this.repair = false;
    this.state = { status: 'checking', modelName: 'DACTYL AI Text Detector', totalBytes, cachedBytes: 0, progress: null, error: null, sequence: 0 };
    this.initialized = this.checkLocal();
  }
  getState() { return { ...this.state }; }
  update(patch) { this.state = { ...this.state, ...patch, sequence: this.state.sequence + 1 }; this.emit('change', this.getState()); }
  async checkLocal() {
    const folder = path.join(this.hubDirectory, `models--${manifest.model.replaceAll('/', '--')}`, 'snapshots', manifest.revision);
    const files = await Promise.all(manifest.files.map(async (file) => {
      try { const info = await stat(path.join(folder, file.name)); return info.isFile() && info.size === file.size ? file.size : 0; }
      catch { return 0; }
    }));
    const cachedBytes = files.reduce((sum, size) => sum + size, 0);
    this.update({ status: cachedBytes === totalBytes ? 'ready' : 'not-downloaded', cachedBytes, progress: null, error: null });
  }
  async status() { await this.initialized; return this.getState(); }
  receive(status) {
    if (status.phase === 'downloading') this.update({ status: 'downloading', progress: status.progress ?? this.state.progress, error: null });
    else if (status.phase === 'loading' && !this.downloadPromise && this.state.progress?.downloadedBytes === totalBytes) {
      // A cache removed externally after startup can be recovered by the
      // analyzer itself. Its loading status follows the final verified bytes.
      this.update({ status: 'ready', cachedBytes: totalBytes, progress: null, error: null });
    }
  }
  download() {
    // Assign the promise before any asynchronous work, so every caller joins it.
    if (this.downloadPromise) return this.downloadPromise;
    this.downloadPromise = this.performDownload().finally(() => { this.downloadPromise = null; });
    return this.downloadPromise;
  }
  async performDownload() {
    await this.initialized;
    if (this.state.status === 'ready' && !this.repair) return { ok: true };
    if (this.analysisPromise) await this.analysisPromise;
    this.update({ status: 'downloading', progress: null, error: null });
    let response;
    try { response = await this.client.downloadModel((status) => this.receive(status), this.repair); }
    catch { response = { ok: false, error: "ProofGPT's detection engine could not be started. Try reinstalling ProofGPT." }; }
    if (response.ok) {
      this.repair = false;
      this.update({ status: 'ready', cachedBytes: totalBytes, progress: null, error: null });
    } else {
      this.repair ||= response.code === 'MODEL_INTEGRITY';
      this.update({ status: 'failed', progress: null, error: response.error });
    }
    return response;
  }
  async analyze(text, onStatus = () => {}) {
    if (typeof text !== 'string' || text.length > 15000 || (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length < 50) {
      return { ok: false, error: 'Please enter at least 50 words, within 15,000 characters.' };
    }
    // The analysis caller owns its request; a Settings download is joined first.
    const listener = (state) => {
      if (state.status === 'downloading') onStatus({ phase: 'downloading', message: 'Downloading detection model...', ...(state.progress ? { progress: state.progress } : {}) });
    };
    this.on('change', listener);
    try {
      await this.initialized;
      if (this.downloadPromise || this.state.status !== 'ready') {
        listener(this.state);
        const downloaded = await this.download();
        if (!downloaded.ok) return downloaded;
      }
      this.analysisPromise = this.client.analyze(text, (status) => { this.receive(status); onStatus(status); });
      const result = await this.analysisPromise;
      if (!result.ok && (this.state.status === 'downloading' || ['MODEL_LOAD', 'MODEL_INTEGRITY', 'MODEL_DOWNLOAD'].includes(result.code))) {
        this.repair ||= ['MODEL_LOAD', 'MODEL_INTEGRITY'].includes(result.code);
        this.update({ status: 'failed', progress: null, error: result.error });
      } else if (result.ok && this.state.status === 'downloading') {
        this.update({ status: 'ready', cachedBytes: totalBytes, progress: null, error: null });
      }
      return result;
    } finally { this.analysisPromise = null; this.off('change', listener); }
  }
}
module.exports = { ModelManager };
