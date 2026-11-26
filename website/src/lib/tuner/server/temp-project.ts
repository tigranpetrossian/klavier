import { vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const ORIGIN = 'http://localhost:3000';

const HOST = 'localhost:3000';

const createdRoots: string[] = [];

export type TempProject = {
  root: string;
  read(file: string): Promise<string>;
  write(file: string, text: string): Promise<void>;
};

export async function createProject(
  files: Record<string, string>,
  options: { exclude?: readonly string[] } = {}
): Promise<TempProject> {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'tuner-server-')));
  const project = {
    root,
    read: (file: string) => fs.readFile(path.join(root, file), 'utf8'),
    write: async (file: string, text: string) => {
      await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await fs.writeFile(path.join(root, file), text);
    },
  };
  for (const [file, text] of Object.entries(files)) {
    await project.write(file, text);
  }
  vi.stubEnv(
    'TUNER_OPTIONS',
    JSON.stringify({
      root,
      sourceDirectory: 'src',
      exclude: options.exclude ?? [],
    })
  );
  createdRoots.push(root);
  return project;
}

export async function removeProjects(): Promise<void> {
  vi.unstubAllEnvs();
  const roots = createdRoots.splice(0);
  await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true })));
}

export function sameOriginGet(url: string): Request {
  return new Request(`${ORIGIN}${url}`, {
    headers: { Host: HOST, 'Sec-Fetch-Site': 'same-origin' },
  });
}

export function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return postText(url, JSON.stringify(body), headers);
}

export function postText(url: string, body: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${url}`, {
    method: 'POST',
    headers: {
      Host: HOST,
      Origin: ORIGIN,
      'Sec-Fetch-Site': 'same-origin',
      'Content-Type': 'application/json',
      ...headers,
    },
    body,
  });
}
