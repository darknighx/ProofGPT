const { productName } = require('./package.json');
const icon = 'build/icons/icon.ico';

module.exports = {
  appId: 'com.proofgpt.desktop', productName,
  asar: true, directories: { output: 'release', buildResources: 'build' },
  files: ['dist/**/*', 'electron/**/*', '!electron/python-discovery.cjs', 'shared/**/*', 'package.json', '!**/*.map'],
  beforePack: async () => {
    const { stat, readFile } = require('node:fs/promises');
    const { createHash } = require('node:crypto');
    const runtime = 'detector/dist/proofgpt-detector';
    await stat(`${runtime}/ProofGPTDetector.exe`);
    const manifest = JSON.parse(await readFile(`${runtime}/runtime-manifest.json`, 'utf8'));
    if (!manifest.frozen || manifest.bits !== 64 || manifest.cuda !== null) throw new Error('Build the verified CPU x64 detector with npm run build:detector before packaging.');
    const sourceHash = createHash('sha256').update(await readFile('detector/detector.py')).digest('hex');
    if (sourceHash !== manifest.sourceSha256) throw new Error('The bundled detector is stale. Run npm run build:detector.');
    for (const [file, field] of [['detector/model_cache.py', 'modelCacheSha256'], ['shared/model-manifest.json', 'modelManifestSha256']]) {
      if (createHash('sha256').update(await readFile(file)).digest('hex') !== manifest[field]) throw new Error('The bundled model manager is stale. Run npm run build:detector.');
    }
  },
  extraResources: [
    { from: 'detector/dist/proofgpt-detector', to: 'detector-runtime', filter: ['**/*'] },
    { from: 'README.md', to: 'README.md' },
    { from: 'docs', to: 'docs', filter: ['**/*.md'] },
    { from: 'build/icons', to: 'icons', filter: ['*.png', '*.ico'] },
  ],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon },
  nsis: {
    oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
    installerIcon: icon, uninstallerIcon: icon,
    createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: productName,
    deleteAppDataOnUninstall: false,
    artifactName: 'ProofGPT-Setup-${version}-${arch}.${ext}',
  },
  publish: null,
};
