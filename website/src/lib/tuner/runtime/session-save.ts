import {
  SAVE_ENDPOINT,
  type SaveRequest,
  type SaveResponse,
  type SaveSkip,
  type SaveValue,
} from '../shared/save-protocol';
import { isPlainObject } from './plain-data';
import type { SaveState, SkippedValue } from './value-types';

export type SavePlan = { readonly values: readonly SaveValue[]; readonly skipped: readonly SkippedValue[] };

const FAILURE_REASONS = {
  unreachable: 'The dev server could not be reached',
  unreadable: 'The dev server sent a response the tuner cannot read',
};

export async function requestSave(request: SaveRequest): Promise<SaveResponse> {
  const response = await attempt(() =>
    fetch(SAVE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  );
  if (response === null) return { ok: false, reason: FAILURE_REASONS.unreachable };
  const parsed = parseSaveResponse(await attempt<unknown>(() => response.json()));
  if (!response.ok) return parsed?.ok === false ? parsed : { ok: false, reason: statusReason(response.status) };
  return parsed ?? { ok: false, reason: FAILURE_REASONS.unreadable };
}

export function saveOutcome(plan: SavePlan, response: SaveResponse): SaveState {
  if (!response.ok) return { status: 'failed', reason: response.reason };
  const locations = new Map(plan.values.map((value) => [value.id, value.location]));
  const serverSkips = response.skipped.map(({ id, reason }) => ({ id, location: locations.get(id) ?? null, reason }));
  return { status: 'saved', savedCount: response.saved.length, skipped: [...plan.skipped, ...serverSkips] };
}

function parseSaveResponse(body: unknown): SaveResponse | null {
  if (!isPlainObject(body)) return null;
  if (body.ok === false && typeof body.reason === 'string') return { ok: false, reason: body.reason };
  if (body.ok === true && isStringList(body.saved) && isSkipList(body.skipped)) {
    return { ok: true, saved: body.saved, skipped: body.skipped };
  }
  return null;
}

function statusReason(status: number): string {
  return `The dev server answered with status ${status}`;
}

async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSkipList(value: unknown): value is SaveSkip[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isPlainObject(item) && typeof item.id === 'string' && typeof item.reason === 'string')
  );
}
