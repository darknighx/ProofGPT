import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

if (process.platform !== 'win32') throw new Error('This release workflow targets Windows x64. Run it on Windows.');
const npmCLI = process.env.npm_execpath;
if (!npmCLI) throw new Error('Use npm run dist:win or npm run pack:win.');
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run([npmCLI, 'run', 'build:detector']);
run([npmCLI, 'run', 'build']);
run([path.resolve('node_modules/electron-builder/cli.js'), '--config', 'electron-builder.config.cjs', '--win', '--x64', '--publish', 'never', ...(process.argv.includes('--dir') ? ['--dir'] : [])]);
if (!process.argv.includes('--dir')) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const name = `ProofGPT-Setup-${version}-x64.exe`;
  const checksum = createHash('sha256').update(await readFile(path.join('release', name))).digest('hex');
  await writeFile(path.join('release', `${name}.sha256`), `${checksum}  ${name}\n`);
}
