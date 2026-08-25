// zip.js — zips dist/ into stayawake-extension.zip for easy sharing.
// (Not needed for local "load unpacked" development — Chrome loads the
// dist/ folder directly. This is just for handing the built extension
// to someone else.)

import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');
const distDir = path.join(projectRoot, 'dist');
const outFile = path.join(projectRoot, 'stayawake-extension.zip');

const output = createWriteStream(outFile);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✔ wrote ${outFile} (${archive.pointer()} bytes)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
