import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Scan only the renderer entry, not HTML files inside Python's dependencies.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    watch: { ignored: ['**/.venv/**', '**/.model-cache/**', '**/.npm-cache/**', '**/.electron-cache/**', '**/artifacts/**'] },
  },
});
