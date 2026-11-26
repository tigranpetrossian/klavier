import type { Plugin } from 'vitest/config';
import { GET } from '../../server/declarations-route.ts';
import { DECLARATIONS_ENDPOINT } from '../../shared/declarations-protocol.ts';
import { transformModule } from '../../transform/transform-module.ts';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '../../../../..');
const SOURCE_DIRECTORY = 'src/lib/tuner/browser-tests';
const SUPPORT_DIRECTORY = `${SOURCE_DIRECTORY}/support`;
const TEST_FILE_SUFFIX = /\.browser\.test\.tsx?$/;
const EDIT_QUERY = 'edit';
const FORWARDED_HEADERS = ['host', 'origin', 'sec-fetch-site'];

export function tunerTransformPlugin(): Plugin {
  return {
    name: 'tuner-transform',
    enforce: 'pre',
    load(id) {
      const edit = editedFile(id);
      return edit === null ? null : fs.readFileSync(edit, 'utf8');
    },
    transform(code, id) {
      const file = filePart(id);
      if (TEST_FILE_SUFFIX.test(file)) return null;
      const result = transformModule(code, {
        file,
        root: ROOT,
        sourceDirectory: SOURCE_DIRECTORY,
        exclude: [SUPPORT_DIRECTORY],
      });
      if (result === null) return null;
      for (const dependency of result.dependencies) this.addWatchFile(dependency);
      return { code: result.code, map: result.map && JSON.stringify(result.map) };
    },
  };
}

export function declarationsEndpointPlugin(): Plugin {
  return {
    name: 'tuner-declarations-endpoint',
    configureServer(server) {
      server.middlewares.use(DECLARATIONS_ENDPOINT, (request, response) => {
        void answer(request, response);
      });
    },
  };
}

function editedFile(id: string): string | null {
  const edit = new URLSearchParams(id.split('?')[1] ?? '').get(EDIT_QUERY);
  if (edit === null) return null;
  const file = filePart(id);
  const extension = path.extname(file);
  return `${file.slice(0, -extension.length)}.edit-${edit}${extension}`;
}

function filePart(id: string): string {
  return id.split('?')[0];
}

async function answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
  process.env.TUNER_OPTIONS = JSON.stringify(optionsFor(testFileOf(request)));
  const answered = await GET(toFetchRequest(request));
  response.statusCode = answered.status;
  response.setHeader('Content-Type', 'application/json');
  response.end(await answered.text());
}

function optionsFor(testFile: string | null) {
  const stylesheets = testFile === null ? null : projectPath(testFile).replace(TEST_FILE_SUFFIX, '');
  if (stylesheets !== null && fs.existsSync(path.join(ROOT, stylesheets)))
    return { root: ROOT, sourceDirectory: stylesheets, exclude: [] };
  return { root: ROOT, sourceDirectory: SOURCE_DIRECTORY, exclude: [SOURCE_DIRECTORY] };
}

function testFileOf(request: IncomingMessage): string | null {
  // Vitest loads each browser test file in an iframe whose URL names the file in `iframeId`.
  const referer = request.headers.referer;
  return referer === undefined ? null : (URL.parse(referer)?.searchParams.get('iframeId') ?? null);
}

function projectPath(file: string): string {
  const absolute = path.isAbsolute(file) && fs.existsSync(file) ? file : path.join(ROOT, file);
  return path.relative(ROOT, absolute);
}

function toFetchRequest(request: IncomingMessage): Request {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers[name];
    if (typeof value === 'string') headers.set(name, value);
  }
  return new Request(`http://${request.headers.host ?? 'localhost'}${DECLARATIONS_ENDPOINT}`, { headers });
}
