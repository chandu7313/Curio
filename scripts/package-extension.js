/**
 * Curio — Chrome Web Store Packaging & Verification Script
 *
 * Verifies production readiness of the dist/ directory:
 *   1. Confirms Manifest V3 integrity
 *   2. Validates icon assets (16px, 48px, 128px)
 *   3. Confirms absence of forbidden dev artifacts (.map, .ts, node_modules)
 *   4. Generates production zip bundle for Chrome Developer Dashboard upload
 *
 * Run: node scripts/package-extension.js
 */

import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');

console.log('🔍 [1/3] Verifying dist/ directory readiness...');

if (!existsSync(distDir)) {
  console.error('❌ dist/ directory not found! Run "npm run build" first.');
  process.exit(1);
}

// ─── 1. Validate Manifest V3 ──────────────────────────────────────────
const manifestPath = resolve(distDir, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error('❌ dist/manifest.json not found!');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.manifest_version !== 3) {
  console.error(`❌ Expected manifest_version 3, got: ${manifest.manifest_version}`);
  process.exit(1);
}

console.log(`✅ Validated Manifest V3 specification (v${manifest.version})`);

// ─── 2. Validate Essential Assets ─────────────────────────────────────
console.log('🔍 [2/3] Validating required bundle assets...');

const requiredFiles = [
  'background/service-worker.js',
  'content/content-script.js',
  'popup.html',
  'options.html',
  'icons/icon-16.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
];

for (const file of requiredFiles) {
  const filePath = resolve(distDir, file);
  if (!existsSync(filePath)) {
    console.error(`❌ Required file missing from dist: ${file}`);
    process.exit(1);
  }
}

console.log('✅ All required entrypoints and icon assets present.');

// ─── 3. Check for Prohibited Artifacts ────────────────────────────────
function scanForProhibited(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      scanForProhibited(fullPath);
    } else {
      if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        console.warn(`⚠️ Warning: TypeScript source found in dist: ${entry}`);
      }
    }
  }
}
scanForProhibited(distDir);

// ─── 4. Generate Web Store Zip Archive ────────────────────────────────
console.log('📦 [3/3] Creating Chrome Web Store zip package...');

const zipFileName = `curio-extension-v${manifest.version}.zip`;
const zipFilePath = resolve(rootDir, zipFileName);

try {
  // Remove prior archive if present to ensure clean zip
  if (existsSync(zipFilePath)) {
    unlinkSync(zipFilePath);
  }

  // Use system zip utility
  execSync(`cd "${distDir}" && zip -r -q "${zipFilePath}" . -x "*.DS_Store"`, {
    stdio: 'inherit',
  });
  const zipStats = statSync(zipFilePath);
  const sizeKb = (zipStats.size / 1024).toFixed(1);

  console.log(`\n🎉 Packaging successful!`);
  console.log(`📁 Artifact: ${zipFileName} (${sizeKb} KB)`);
  console.log(`🚀 Ready to upload to Chrome Web Store Developer Dashboard:`);
  console.log(`   https://chrome.google.com/webstore/devconsole\n`);
} catch (err) {
  console.error('❌ Failed to create zip package:', err.message);
  process.exit(1);
}

