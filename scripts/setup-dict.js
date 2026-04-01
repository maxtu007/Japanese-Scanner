/**
 * One-time setup: downloads the latest JMdict simplified English JSON.
 * Run once: npm run setup-dict
 *
 * Output: data/jmdict-eng.json (~230MB)
 * The server loads this file at startup for instant local dictionary lookups.
 */
import { createWriteStream, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';

const OUTPUT = './data/jmdict-eng.json';

mkdirSync('./data', { recursive: true });

console.log('Fetching latest JMdict release info from GitHub…');

const metaRes = await fetch(
  'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest',
  { headers: { 'User-Agent': 'japan-scanner-setup' } }
);

if (!metaRes.ok) throw new Error(`GitHub API error: ${metaRes.status}`);

const release = await metaRes.json();
const asset   = release.assets?.find(
  (a) => a.name.startsWith('jmdict-eng') && a.name.endsWith('.json.gz')
);

if (!asset) throw new Error('Could not find jmdict-eng asset in latest release');

const sizeMB = Math.round(asset.size / 1024 / 1024);
console.log(`Downloading ${asset.name} (${sizeMB} MB compressed)…`);

const dlRes = await fetch(asset.browser_download_url);
if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);

await pipeline(dlRes.body, createGunzip(), createWriteStream(OUTPUT));

console.log(`\nDone → ${OUTPUT}`);
console.log('You can now restart the dev server. Lookups will use local JMdict.');
