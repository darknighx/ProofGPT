import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electron from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
console.info('Starting ProofGPT development server...');
const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  server: { port: 5173, strictPort: false },
});
try { await server.listen(); } catch (error) {
  await server.close();
  console.error('ProofGPT could not start its development server:', error.message);
  process.exit(1);
}
const url = server.resolvedUrls.local[0];
console.info(`Launching ProofGPT at ${url}`);
const env = { ...process.env, PROOFGPT_DEV_URL: url };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, [root], { cwd: root, stdio: 'inherit', env });
let closing = false;
async function shutdown(code = 0) {
  if (closing) return;
  closing = true;
  child.kill();
  await server.close();
  process.exit(code);
}
child.on('exit', (code) => shutdown(code ?? 0));
child.on('error', (error) => { console.error(error); shutdown(1); });
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
