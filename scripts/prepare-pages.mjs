import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(project, 'dist');
const destination = path.join(project, 'docs');

// Check that a completed production build exists before replacing the published files.
await readFile(path.join(source, 'index.html'));
await readFile(path.join(source, 'sw.js'));
await rm(destination, { recursive: true, force: true });
await cp(source, destination, { recursive: true });
await writeFile(path.join(destination, '.nojekyll'), '');
console.log('GitHub Pages: готова папка docs/. История занятий в сборку не входит.');
