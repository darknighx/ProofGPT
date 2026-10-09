const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const { DetectorClient } = require('./detector-client.cjs');
const { HistoryStore } = require('./history-store.cjs');
const { randomUUID } = require('node:crypto');
const { saveReportExport } = require('./report-export.cjs');
const { SettingsStore } = require('./settings-store.cjs');
const { ModelManager } = require('./model-manager.cjs');

app.setName('ProofGPT');
// Honor Chromium's explicit profile flag, including isolated automated tests.
const profileDirectory = app.commandLine.getSwitchValue('user-data-dir');
if (profileDirectory) app.setPath('userData', path.resolve(profileDirectory));
const resourceRoot = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
const modelCacheDirectory = app.isPackaged ? path.join(app.getPath('userData'), 'model-cache') : process.env.HF_HOME || path.join(resourceRoot, '.model-cache');
const detector = new DetectorClient({ root: resourceRoot, diagnostics: !app.isPackaged,
  cacheDirectory: modelCacheDirectory,
  ...(app.isPackaged ? { bundledExecutable: path.join(process.resourcesPath, 'detector-runtime', 'ProofGPTDetector.exe') } : {}),
});
const models = new ModelManager({ client: detector, cacheDirectory: modelCacheDirectory,
  ...(!app.isPackaged && process.env.HF_HUB_CACHE ? { hubDirectory: process.env.HF_HUB_CACHE } : {}),
});
models.on('change', (state) => { for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('model:state', state); });
// Windows uses the multi-resolution ICO; other hosts can use the approved PNG.
const windowIcon = path.join(resourceRoot, app.isPackaged ? 'icons' : 'build/icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
app.setAppUserModelId('com.proofgpt.desktop');
let history, preferences;
let analysisInProgress = false, resettingData = false;
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
});
function createWindow() {
  const window = new BrowserWindow({
    width: 1412, height: 1048, minWidth: 850, minHeight: 660,
    title: 'ProofGPT', frame: false, backgroundColor: '#0e1120',
    icon: windowIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => detector.stop());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  const loading = !app.isPackaged && process.env.PROOFGPT_DEV_URL ? window.loadURL(process.env.PROOFGPT_DEV_URL) : window.loadFile(path.join(__dirname, '../dist/index.html'));
  void loading.catch(() => { if (window.isDestroyed()) return; dialog.showErrorBox('ProofGPT could not start', 'The application interface could not be loaded. For a source checkout, run npm run build; for an installed app, reinstall ProofGPT.'); window.close(); });
}

const validCaller = (event) => BrowserWindow.fromWebContents(event.sender) && event.senderFrame === event.sender.mainFrame;
ipcMain.handle('model:status', (event) => validCaller(event) ? models.status() : null);
ipcMain.handle('model:download', (event) => validCaller(event) ? models.download() : { ok: false, error: 'Invalid model download request.' });
// Only the bundled project README can be opened; the renderer supplies no path or URL.
ipcMain.handle('help:openDocumentation', async (event) => {
  if (!validCaller(event)) return { ok: false, error: 'Invalid documentation request.' };
  try {
    const error = await shell.openPath(path.join(resourceRoot, 'README.md'));
    return error ? { ok: false, error: `Documentation could not be opened. ${error}` } : { ok: true };
  } catch (error) { return { ok: false, error: `Documentation could not be opened. ${error.message}` }; }
});
ipcMain.handle('detector:analyze', async (event, text) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || event.senderFrame !== event.sender.mainFrame) return { ok: false, error: 'Invalid detector caller.' };
  if (resettingData) return { ok: false, error: 'Wait for the data reset to finish before analyzing text.' };
  if (analysisInProgress) return { ok: false, error: 'An analysis is already in progress.' };
  analysisInProgress = true;
  try {
    const response = await models.analyze(text, (status) => {
      if (!event.sender.isDestroyed()) event.sender.send('detector:status', status);
    });
    if (!response.ok) return response;
    const record = { ...response.result, id: randomUUID(), text,
      preview: text.trim().replace(/\s+/g, ' ').slice(0, 160), analyzedAt: new Date().toISOString() };
    try {
      const settings = await preferences.get();
      if (!settings.saveHistory) return { ...response, record, savedToHistory: false };
      await history.add(record); return { ...response, record, savedToHistory: true };
    } catch (error) { return { ...response, record, savedToHistory: false, historyError: error.message }; }
  } finally { analysisInProgress = false; }
});
for (const operation of ['list', 'remove', 'clear']) {
  ipcMain.handle(`history:${operation}`, async (event, id) => {
    if (!validCaller(event) || (operation === 'remove' && typeof id !== 'string')) return { ok: false, error: 'Invalid history request.' };
    try { return { ok: true, records: await history[operation](id) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
app.on('before-quit', () => detector.stop());

ipcMain.handle('settings:get', async (event) => {
  if (!validCaller(event)) return { ok: false, error: 'Invalid settings request.' };
  try { return { ok: true, settings: await preferences.get(), version: app.getVersion() }; }
  catch (error) { return { ok: false, error: error.message }; }
});
for (const operation of ['update', 'restoreDefaults']) {
  ipcMain.handle(`settings:${operation}`, async (event, patch) => {
    if (!validCaller(event)) return { ok: false, error: 'Invalid settings request.' };
    try { return { ok: true, settings: await preferences[operation](patch) }; }
    catch (error) { return { ok: false, error: error.message }; }
  });
}
ipcMain.handle('settings:resetData', async (event) => {
  if (!validCaller(event)) return { ok: false, error: 'Invalid data reset request.' };
  if (analysisInProgress || resettingData) return { ok: false, error: 'Wait for the current analysis or reset to finish before resetting ProofGPT data.' };
  resettingData = true;
  let historyCleared = false;
  try {
    const records = await history.clear(); historyCleared = true;
    const settings = await preferences.restoreDefaults();
    return { ok: true, settings, records };
  } catch (error) { return { ok: false, error: historyCleared ? `History was cleared, but settings could not be restored. ${error.message}` : error.message }; }
  finally { resettingData = false; }
});

ipcMain.handle('report:export', (event, format, data) => {
  if (!validCaller(event)) return { ok: false, error: 'Invalid report export caller.' };
  return saveReportExport({ window: BrowserWindow.fromWebContents(event.sender), format, data, dialog, documentsDirectory: app.getPath('documents') });
});

ipcMain.on('window-control', (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return;
  if (action === 'minimize') window.minimize();
  if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize();
  if (action === 'close') window.close();
});
if (singleInstance) app.whenReady().then(() => {
  history = new HistoryStore(path.join(app.getPath('userData'), 'history.json'));
  preferences = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
}).catch(() => { dialog.showErrorBox('ProofGPT could not start', 'The desktop window could not be initialized. Close ProofGPT and try again.'); app.quit(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
