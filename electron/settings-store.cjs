const fs = require('node:fs/promises');
const defaults = require('../shared/settings-defaults.json');
const { writeAtomicJSON } = require('./atomic-json.cjs');
const allowed = {
  theme: (value) => value === 'dark', language: (value) => value === 'en',
  startPage: (value) => ['home', 'history', 'reports', 'settings'].includes(value),
  warnShortText: (value) => typeof value === 'boolean', detailLevel: (value) => ['standard', 'detailed'].includes(value),
  includeExplanations: (value) => typeof value === 'boolean', saveHistory: (value) => typeof value === 'boolean',
  defaultExportFormat: (value) => ['csv', 'json'].includes(value), includeChartData: (value) => typeof value === 'boolean',
};
function validSettings(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === Object.keys(allowed).length
    && Object.entries(allowed).every(([key, validate]) => validate(value[key]));
}
class SettingsStore {
  constructor(file) { this.file = file; this.queue = Promise.resolve(); }
  serialize(operation) {
    const result = this.queue.then(operation); this.queue = result.catch(() => {}); return result;
  }
  async read() {
    let data;
    try { data = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return { ...defaults };
      throw new Error('Settings could not be read. The existing settings file has been preserved.', { cause: error });
    }
    if (!data || data.version !== 1 || !validSettings(data.settings)) {
      throw new Error('Settings have an unsupported or damaged format. The existing settings file has been preserved.');
    }
    return data.settings;
  }
  write(settings) { return writeAtomicJSON(this.file, { version: 1, settings }, 'Settings could not be saved. Check folder permissions and free disk space.'); }
  get() { return this.serialize(() => this.read()); }
  update(patch) {
    return this.serialize(async () => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length
        || !Object.entries(patch).every(([key, value]) => Object.hasOwn(allowed, key) && allowed[key](value))) {
        throw new Error('The requested setting is not supported.');
      }
      const settings = { ...await this.read(), ...patch };
      await this.write(settings); return settings;
    });
  }
  // Explicit, confirmed action may restore a damaged settings file too.
  restoreDefaults() { return this.serialize(async () => { const settings = { ...defaults }; await this.write(settings); return settings; }); }
}
module.exports = { SettingsStore, defaults, validSettings };
