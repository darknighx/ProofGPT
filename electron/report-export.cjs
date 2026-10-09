const fs = require('node:fs/promises');
const path = require('node:path');

/** Renderer supplies serialized real records; only a native save dialog chooses the path. */
async function saveReportExport({ window, format, data, dialog, documentsDirectory }) {
  if (!['csv', 'json'].includes(format) || typeof data !== 'string' || !data.length) {
    return { ok: false, error: 'The requested report export is invalid.' };
  }
  try {
    const response = await dialog.showSaveDialog(window, {
      title: 'Export ProofGPT report',
      defaultPath: path.join(documentsDirectory, `ProofGPT-Report-${new Date().toISOString().slice(0, 10)}.${format}`),
      filters: [{ name: format === 'csv' ? 'CSV spreadsheet' : 'JSON report', extensions: [format] }],
      properties: ['createDirectory', 'showOverwriteConfirmation'],
    });
    if (response.canceled || !response.filePath) return { ok: true, canceled: true };
    await fs.writeFile(response.filePath, data, 'utf8');
    return { ok: true, canceled: false, path: response.filePath };
  } catch { return { ok: false, error: 'The report could not be saved. Check the folder permissions and free disk space, then try again.' }; }
}
module.exports = { saveReportExport };
