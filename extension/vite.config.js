import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        background: resolve(__dirname, 'src/background/background.js'),
        offscreen: resolve(__dirname, 'src/offscreen/offscreen.js'),
      },
      output: {
        entryFileNames: (chunk) => {
          // Keep background.js / offscreen.js at predictable top-level
          // paths since manifest.json and offscreen.html reference them
          // by exact filename.
          if (chunk.name === 'background') return 'background.js';
          if (chunk.name === 'offscreen') return 'offscreen.js';
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
});
