const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function writeAtomicJSON(file, value, message) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(value, null, 2), 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temporary, file);
  } catch {
    await fs.unlink(temporary).catch(() => {});
    throw new Error(message);
  }
}
module.exports = { writeAtomicJSON };
