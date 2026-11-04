process.env.NODE_ENV = 'production';

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

async function buildExtension() {
  console.log('🚀 [1/2] Building Extension Pages & Service Worker (JavaScript Modules)...');
  await build({
    root: rootDir,
    base: '',
    mode: 'production',
    configFile: false,
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      minify: true,
      rollupOptions: {
        input: {
          popup: resolve(rootDir, 'popup.html'),
          options: resolve(rootDir, 'options.html'),
          'background/service-worker': resolve(rootDir, 'src/background/service-worker.js'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  });

  console.log('📦 [2/2] Building Standalone Content Script (IIFE Isolation)...');
  await build({
    root: rootDir,
    base: '',
    mode: 'production',
    configFile: false,
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false, // Keep previous build artifacts!
      minify: true,
      rollupOptions: {
        input: resolve(rootDir, 'src/content/content-script.js'),
        output: {
          format: 'iife',
          name: 'CurioContentScript',
          entryFileNames: 'content/content-script.js',
          inlineDynamicImports: true,
        },
      },
    },
  });

  console.log('✅ Curio JavaScript extension build completed successfully!');
}

buildExtension().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
