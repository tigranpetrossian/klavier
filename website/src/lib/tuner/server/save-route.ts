import type { SaveResponse, SaveSkip } from '../shared/save-protocol.ts';
import { readText, realSourceDirectory, resolveSourceFile, writeAtomically } from './project-files.ts';
import { formatLikeOriginal } from './prettier-format.ts';
import { guardRequest } from './request-guard.ts';
import { parseSaveRequest, type SaveItem } from './save-request.ts';
import { applyEdits, type SourceEdit } from './source-edits.ts';
import { indexSource } from './source-index.ts';
import { isDeepStrictEqual } from 'node:util';

const SKIP_REASONS = {
  outsideSource: 'The file is not under the source directory',
  unreadable: 'The file cannot be read',
  changed: 'The file changed since the page loaded',
  readBack: 'The edit could not be read back, so the file was left unchanged',
  unformattable: 'The edited file could not be formatted, so it was left unchanged',
  unwritable: 'The file cannot be written',
};

type FileOutcome = { saved: readonly string[]; skipped: readonly SaveSkip[] };

type PlannedEdit = { item: SaveItem; edits: readonly SourceEdit[] };

export async function POST(request: Request): Promise<Response> {
  const guard = guardRequest(request);
  if (!guard.ok) {
    return respond({ ok: false, reason: guard.reason }, guard.status);
  }
  const items = parseSaveRequest(await readJson(request));
  if (items === null) {
    return respond({ ok: false, reason: 'The request body is not a save request' }, 400);
  }
  const sourceDirectory = await realSourceDirectory(guard.options);
  if (sourceDirectory === null) {
    return respond({ ok: false, reason: 'Cannot read the source directory' }, 500);
  }
  const { files, skipped } = await groupByFile(sourceDirectory, guard.options.root, items);
  const outcomes = await Promise.all([...files].map(([file, fileItems]) => saveFile(file, fileItems)));
  return respond(
    {
      ok: true,
      saved: outcomes.flatMap((outcome) => outcome.saved),
      skipped: [...skipped, ...outcomes.flatMap((outcome) => outcome.skipped)],
    },
    200
  );
}

async function groupByFile(
  sourceDirectory: string,
  root: string,
  items: readonly SaveItem[]
): Promise<{
  files: ReadonlyMap<string, readonly SaveItem[]>;
  skipped: readonly SaveSkip[];
}> {
  const files = new Map<string, SaveItem[]>();
  const skipped: SaveSkip[] = [];
  const resolved = await Promise.all(items.map((item) => resolveSourceFile(sourceDirectory, root, item.file)));
  items.forEach((item, index) => {
    const file = resolved[index];
    if (file === null) {
      skipped.push({ id: item.id, reason: SKIP_REASONS.outsideSource });
    } else files.set(file, [...(files.get(file) ?? []), item]);
  });
  return { files, skipped };
}

async function saveFile(file: string, items: readonly SaveItem[]): Promise<FileOutcome> {
  const original = await readText(file);
  if (original === null) return skipAll(items, SKIP_REASONS.unreadable);
  const { planned, skipped } = planEdits(file, original, items);
  const written = planned.length === 0 ? { saved: [], skipped: [] } : await writeEdits(file, original, planned);
  return { saved: written.saved, skipped: [...skipped, ...written.skipped] };
}

async function writeEdits(file: string, original: string, planned: readonly PlannedEdit[]): Promise<FileOutcome> {
  const items = planned.map(({ item }) => item);
  const edited = applyEdits(
    original,
    planned.flatMap(({ edits }) => edits)
  );
  if (!holdsSavedValues(file, edited, items)) {
    return skipAll(items, SKIP_REASONS.readBack);
  }
  const formatted = await formatLikeOriginal(file, original, edited);
  if (formatted === null) return skipAll(items, SKIP_REASONS.unformattable);
  if (!findsEachOnce(file, formatted, items)) {
    return skipAll(items, SKIP_REASONS.readBack);
  }
  if (!(await writeAtomically(file, formatted))) {
    return skipAll(items, SKIP_REASONS.unwritable);
  }
  return { saved: items.map((item) => item.id), skipped: [] };
}

function planEdits(
  file: string,
  text: string,
  items: readonly SaveItem[]
): { planned: readonly PlannedEdit[]; skipped: readonly SaveSkip[] } {
  const find = indexSource(file, text);
  const planned: PlannedEdit[] = [];
  const skipped: SaveSkip[] = [];
  for (const item of items) {
    const found = find(item);
    if (!found.ok) skipped.push({ id: item.id, reason: found.reason });
    else if (!isDeepStrictEqual(found.current, item.loadedDefault)) {
      skipped.push({ id: item.id, reason: SKIP_REASONS.changed });
    } else planned.push({ item, edits: found.edits() });
  }
  return { planned, skipped };
}

function holdsSavedValues(file: string, text: string, items: readonly SaveItem[]): boolean {
  const find = indexSource(file, text);
  return items.every((item) => {
    const found = find(item);
    return found.ok && isDeepStrictEqual(found.current, item.value);
  });
}

function findsEachOnce(file: string, text: string, items: readonly SaveItem[]): boolean {
  const find = indexSource(file, text);
  return items.every((item) => find(item).ok);
}

function skipAll(items: readonly SaveItem[], reason: string): FileOutcome {
  return { saved: [], skipped: items.map((item) => ({ id: item.id, reason })) };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function respond(body: SaveResponse, status: number): Response {
  return Response.json(body, { status });
}
