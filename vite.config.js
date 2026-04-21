import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  resolve: {
    alias: {
      path: 'path-browserify',
      // Replace broken 2012-era IIFE zlibjs (used by kuromoji) with a pako-backed shim.
      // zlibjs assigns to `this.Zlib` which breaks when bundled — pako works everywhere.
      'zlibjs/bin/gunzip.min.js': fileURLToPath(new URL('./src/utils/zlibjs-shim.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['kuromoji'],
  },
});
