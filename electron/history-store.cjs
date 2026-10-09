const fs = require('node:fs/promises');
const { validResult } = require('./detector-client.cjs');
const { writeAtomicJSON } = require('./atomic-json.cjs');

function validRecord(record) {
  return validResult(record) && typeof record.id === 'string' && record.id.length > 0
    && typeof record.text === 'string' && record.text.trim().length > 0 && record.text.length <= 15000
    && record.characterCount === record.text.length
    && typeof record.preview === 'string' && record.preview === record.text.trim().replace(/\s+/g, ' ').slice(0, 160)
    && typeof record.analyzedAt === 'string' && Number.isFinite(Date.parse(record.analyzedAt));
}

/** One store in Electron's main process. Mutations are serialized and atomically
 * replace a versioned JSON file. A damaged file is preserved, never overwritten.
 */
class HistoryStore {
  constructor(file) { this.file = file; this.queue = Promise.resolve(); }
  serialize(operation) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  async read() {
    let data;
    try { data = JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return [];
      throw new Error('History could not be read. Your existing history file has been preserved.', { cause: error });
    }
    if (!data || typeof data !== 'object' || data.version !== 1 || !Array.isArray(data.records) || !data.records.every(validRecord)
      || new Set(data.records.map((record) => record.id)).size !== data.records.length) {
      throw new Error('History has an unsupported or damaged format. Your existing history file has been preserved.');
    }
    return data.records.sort((a, b) => Date.parse(b.analyzedAt) - Date.parse(a.analyzedAt));
  }
  async write(records) {
    await writeAtomicJSON(this.file, { version: 1, records }, 'History could not be saved to this computer. Check free disk space and folder permissions.');
  }
  list() { return this.serialize(() => this.read()); }
  add(record) {
    return this.serialize(async () => {
      if (!validRecord(record)) throw new Error('The analysis record is invalid and was not saved.');
      const records = await this.read();
      if (!records.some((item) => item.id === record.id)) { records.unshift(record); await this.write(records); }
      return records;
    });
  }
  remove(id) {
    return this.serialize(async () => {
      const records = (await this.read()).filter((record) => record.id !== id);
      await this.write(records);
      return records;
    });
  }
  clear() { return this.serialize(async () => { await this.read(); await this.write([]); return []; }); }
}
module.exports = { HistoryStore, validRecord };
