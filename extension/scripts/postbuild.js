// postbuild.js — runs after `vite build`.
// MV3's CSP ('wasm-unsafe-eval' but no remote script-src) means the
// MediaPipe wasm runtime must ship inside the extension, not be fetched
// from Google's CDN at runtime. This copies it from node_modules into
// dist/wasm so offscreen.js's FilesetResolver.forVisionTasks(...) call
// (which points at chrome.runtime.getURL('wasm')) finds it locally.

import { cp, access } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');

const wasmSrc = path.join(
  projectRoot,
  'node_modules/@mediapipe/tasks-vision/wasm'
);
const wasmDest = path.join(projectRoot, 'dist/wasm');

const modelSrc = path.join(projectRoot, 'public/models/face_landmarker.task');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (await exists(wasmSrc)) {
    await cp(wasmSrc, wasmDest, { recursive: true });
    console.log('✔ copied MediaPipe wasm runtime to dist/wasm');
  } else {
    console.warn(
      '⚠ Could not find @mediapipe/tasks-vision/wasm — did `npm install` run? ' +
        'The extension will fail to load the face landmarker without it.'
    );
  }

  if (!(await exists(modelSrc))) {
    console.warn(
      '⚠ public/models/face_landmarker.task is missing. Copy it in from the ' +
        'original Studytrackk-extension repo (or re-download it from ' +
        'MediaPipe\'s model zoo) before loading the unpacked extension.'
    );
  }
}

main();
