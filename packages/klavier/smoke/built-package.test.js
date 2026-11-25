import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import * as klavier from 'klavier';
import * as klavierReact from 'klavier/react';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const PACKAGE_ROOT = new URL('../', import.meta.url);

test('the root entry exports the framework-free API', () => {
  assert.deepEqual(Object.keys(klavier).sort(), ['DEFAULT_KEYMAP', 'createKlavier', 'layoutKeys']);
  assert.equal(typeof klavier.createKlavier, 'function');
  assert.equal(klavier.DEFAULT_KEYMAP.KeyZ, 0);
  assert.equal(klavier.DEFAULT_KEYMAP.KeyQ, 12);
});

test('layoutKeys works without a DOM', () => {
  const layout = klavier.layoutKeys({ width: 1248, height: 150, pixelRatio: 2 });

  assert.equal(layout.keys.length, 88);
  assert.deepEqual(layout.keys[0], { note: 21, black: false, x: 0, y: 0, width: 24, height: 150 });
  assert.deepEqual(layout.keys[1], { note: 22, black: true, x: 20.5, y: 0, width: 14, height: 97.5 });
});

test('klavier/react renders on a server, reserving the height of the keys', () => {
  assert.deepEqual(Object.keys(klavierReact), ['Klavier']);

  const html = renderToString(createElement(klavierReact.Klavier, { range: [60, 71], className: 'piano' }));

  assert.match(html, /^<div class="piano"><div style="[^"]*aspect-ratio:1\.09\d*[^"]*"><\/div><\/div>$/);
});

test('every exported module ships with type declarations', async () => {
  const manifest = await readManifest();
  const modules = Object.values(manifest.exports).filter((path) => path.endsWith('.js'));

  assert.deepEqual(modules, ['./dist/index.js', './dist/react.js']);
  for (const path of modules) await access(new URL(path.replace(/\.js$/, '.d.ts'), PACKAGE_ROOT));
});

test('react is an optional peer that the built files import instead of bundling', async () => {
  const manifest = await readManifest();
  const reactEntry = await readFile(new URL('dist/react.js', PACKAGE_ROOT), 'utf8');

  assert.equal(manifest.peerDependencies.react, '>=19');
  assert.equal(manifest.peerDependenciesMeta.react.optional, true);
  assert.match(reactEntry, /from "react"/);
});

async function readManifest() {
  return JSON.parse(await readFile(new URL('package.json', PACKAGE_ROOT), 'utf8'));
}
