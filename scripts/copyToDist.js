/**
 * Post-build script for the JPL plugin package.
 * Joplin .jpl files are tar archives with flat entries (no ./ prefix).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.resolve(__dirname, '..', 'dist');
const publishDir = path.resolve(__dirname, '..', 'publish');
const rootDir = path.resolve(__dirname, '..');

if (!fs.existsSync(publishDir)) {
  fs.mkdirSync(publishDir, { recursive: true });
}

const jplDest = path.resolve(publishDir, 'io.arena.timetracker.jpl');
if (fs.existsSync(jplDest)) fs.unlinkSync(jplDest);

// Use tar with shell glob (no ./ prefix)
execSync('cd "' + distDir + '" && tar -cf "' + jplDest + '" *', { stdio: 'inherit' });
console.log('Created ' + jplDest);

const publishManifest = path.resolve(publishDir, 'manifest.json');
const manifestSrc = path.resolve(rootDir, 'src', 'manifest.json');
fs.copyFileSync(manifestSrc, publishManifest);
console.log('Copied manifest.json to publish/');
console.log('Build complete!');
