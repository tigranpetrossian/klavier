import { DECLARATIONS_ENDPOINT, type SourceDeclaration, type SourceProblem } from '../shared/declarations-protocol';
import { isPlainObject } from './plain-data';

export type DeclarationsResult =
  | {
      readonly ok: true;
      readonly declarations: readonly SourceDeclaration[];
      readonly problems: readonly SourceProblem[];
    }
  | { readonly ok: false; readonly reason: string };

const FAILURE_REASONS = {
  unreachable: 'The dev server could not be reached',
  unreadable: 'The dev server sent a response the tuner cannot read',
};

export async function requestDeclarations(): Promise<DeclarationsResult> {
  const response = await attempt(() => fetch(DECLARATIONS_ENDPOINT));
  if (response === null) return { ok: false, reason: FAILURE_REASONS.unreachable };
  const parsed = parseDeclarationsResponse(await attempt<unknown>(() => response.json()));
  if (parsed?.ok === false) return parsed;
  if (!response.ok) return { ok: false, reason: `The dev server answered with status ${response.status}` };
  return parsed ?? { ok: false, reason: FAILURE_REASONS.unreadable };
}

function parseDeclarationsResponse(body: unknown): DeclarationsResult | null {
  if (!isPlainObject(body)) return null;
  if (body.ok === false && typeof body.reason === 'string') return { ok: false, reason: body.reason };
  if (
    body.ok !== true ||
    !isListOf(body.declarations, isSourceDeclaration) ||
    !isListOf(body.problems, isSourceProblem)
  )
    return null;
  return { ok: true, declarations: body.declarations, problems: body.problems };
}

function isSourceDeclaration(value: unknown): value is SourceDeclaration {
  return (
    isPlainObject(value) &&
    ['id', 'name', 'context', 'file', 'value', 'selector'].every((key) => typeof value[key] === 'string') &&
    typeof value.line === 'number' &&
    typeof value.important === 'boolean' &&
    typeof value.shadowed === 'boolean' &&
    (value.layer === null || typeof value.layer === 'string') &&
    (value.theme === null || isListOf(value.theme, isString)) &&
    isListOf(value.conditions, isString) &&
    isListOf(value.unsupported, isString)
  );
}

function isSourceProblem(value: unknown): value is SourceProblem {
  return isPlainObject(value) && typeof value.file === 'string' && typeof value.reason === 'string';
}

function isListOf<T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(isItem);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}
