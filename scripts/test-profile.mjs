import { mkdir, mkdtemp } from 'node:fs/promises';
import path from 'node:path';
export async function createTestProfile(name) {
  const root = path.resolve('artifacts/test-profiles');
  await mkdir(root, { recursive: true });
  return mkdtemp(path.join(root, `${name}-`));
}
