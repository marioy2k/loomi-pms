import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const [bump, name, ...changes] = process.argv.slice(2);
if (!['major', 'minor', 'patch'].includes(bump) || !name?.trim() || !changes.length || changes.some(change => !change.trim())) {
  throw Error('Usage: node scripts/release.mjs major|minor|patch "Release name" "What changed" ["Another change"]');
}
const previous = JSON.parse(readFileSync(join(root, 'release.json'), 'utf8'));
const version = previous.version.split('.').map(Number);
if (version.length !== 3 || version.some(n => !Number.isSafeInteger(n) || n < 0)) throw Error('Invalid current version');
const index = {major: 0, minor: 1, patch: 2}[bump];
version[index]++;
for (let i = index + 1; i < 3; i++) version[i] = 0;
const release = {version: version.join('.'), name: name.trim(), changes: changes.map(change => change.trim())};
// Read and validate all inputs before editing either app version.
const roots = [root, ...(existsSync(join(root,'self-hosted/package.json'))?[join(root,'self-hosted')]:[])];
const packages = roots.map(directory => JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')));
roots.forEach((directory, i) => {
  writeFileSync(join(directory, 'release.json'), JSON.stringify(release, null, 2) + '\n');
  writeFileSync(join(directory, 'package.json'), JSON.stringify({...packages[i], version: release.version}, null, 2) + '\n');
});
console.log(`Loomi v${release.version} — ${release.name}`);
