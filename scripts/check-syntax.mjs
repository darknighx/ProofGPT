import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const files = ['electron-builder.config.cjs'];
for (const directory of ['electron', 'scripts']) {
  for (const file of await readdir(directory)) if (/\.(cjs|mjs)$/.test(file)) files.push(path.join(directory, file));
}
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`PASS: JavaScript syntax for ${files.length} main/preload/config/test files.`);
