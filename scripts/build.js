import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'dist');
rmSync(output, { recursive: true, force: true });
mkdirSync(output);
for (const entry of ['index.html', 'src', 'vendor']) {
  cpSync(resolve(root, entry), resolve(output, entry), { recursive: true });
}
writeFileSync(resolve(output, '.nojekyll'), '');
console.log('Built static application in dist/ (no archive data included).');
