import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
assert.match(html, /<html\b/i);
assert.match(html, /<meta[^>]+viewport/i, 'The mobile viewport is required');
assert.ok(existsSync(resolve(dist, '.nojekyll')));
let modules = 0;
function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name);
    const rel = relative(dist, path);
    assert.ok(!/^(?:tests|input|data|node_modules|\.git)(?:\/|$)/.test(rel), `Private or development path in build: ${rel}`);
    if (statSync(path).isDirectory()) { walk(path); continue; }
    if (!path.endsWith('.js') || rel.startsWith('vendor/')) continue;
    const checked = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      assert.ok(existsSync(resolve(dirname(path), match[1])), `Missing module ${match[1]} in ${rel}`);
    }
    modules++;
  }
}
walk(dist);
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const asset = match[1];
  if (/^(?:https?:|data:|#|mailto:)/.test(asset)) continue;
  assert.ok(!asset.startsWith('/'), `Use relative asset paths for GitHub Pages: ${asset}`);
  assert.ok(existsSync(resolve(dist, asset.split(/[?#]/)[0])), `Missing HTML asset: ${asset}`);
}
console.log(`Static build checked: ${modules} JavaScript modules, relative assets, mobile viewport, no development data.`);
