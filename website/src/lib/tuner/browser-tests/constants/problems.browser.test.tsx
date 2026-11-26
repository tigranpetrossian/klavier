import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { clearTuning, isAnything, isNumber, silenceConsole, tunerProblem } from '../support/harness';
import { useTunable, useTunables } from '@/lib/tuner/react';

const FIXTURES = 'src/lib/tuner/browser-tests/constants/problems';
const UNREADABLE_FILE = `${FIXTURES}/unreadable-types.ts`;
const UNSUPPORTED_FILE = `${FIXTURES}/unsupported-types.ts`;
const DEFAULTS_FILE = `${FIXTURES}/broken-defaults.ts`;

const warnings: unknown[][] = [];
const errors: unknown[][] = [];

beforeAll(async () => {
  const warn = silenceConsole('warn');
  const error = silenceConsole('error');
  await import('./problems/unreadable-types');
  await import('./problems/unsupported-types');
  await import('./problems/broken-defaults');
  warnings.push(...warn.mock.calls);
  errors.push(...error.mock.calls);
  vi.restoreAllMocks();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await clearTuning();
});

test.each([
  ['unreadable.generic-alias', 17, [1, 2, 3]],
  ['unreadable.generic-interface', 18, { value: 2 }],
  ['unreadable.extract', 19, 'anywhere'],
  ['unreadable.typeof', 20, { gap: 8 }],
  ['unreadable.indexed-access', 21, 'loud'],
  ['unreadable.keyof', 22, 'other'],
  ['unreadable.mapped', 23, { x: 3, y: 4 }],
  ['unreadable.conditional', 24, 5],
  ['unreadable.package-type', 25, 'column'],
  ['unreadable.global-type', 26, 'other'],
])(
  '%s has a type argument that cannot be read, so it warns and infers the type from the default',
  async (id, line, inferred) => {
    const control = await renderHook(() => useTunable(id, isAnything, undefined));
    let accepted: unknown = false;

    await control.act(() => {
      accepted = control.result.current.onValueChange(inferred);
    });

    expect([warnings, accepted]).toEqual([
      expect.arrayContaining([[tunerProblem(id, `${UNREADABLE_FILE}:${line}`)]]),
      true,
    ]);
  }
);

test.each([
  ['unsupported.function', 8],
  ['unsupported.undefined', 9],
  ['unsupported.optional-field', 10],
  ['unsupported.optional-element', 11],
  ['unsupported.rest-element', 12],
  ['unsupported.bigint', 13],
  ['unsupported.symbol', 14],
  ['unsupported.class', 15],
  ['unsupported.imported-class', 16],
  ['unsupported.unknown', 17],
])('%s has an unsupported type, so it is an error and tuning is off', async (id, line) => {
  const control = await renderHook(() => useTunable(id, isAnything, undefined));
  const warned = warnings.some(([message]) => String(message).includes(`'${id}'`));

  expect([errors, warned, control.result.current.entry]).toEqual([
    expect.arrayContaining([[tunerProblem(id, `${UNSUPPORTED_FILE}:${line}`)]]),
    false,
    null,
  ]);
});

test('a constant with an unsupported type returns its default', async () => {
  const { ON_CLOSE } = await import('./problems/unsupported-types');

  expect(typeof ON_CLOSE).toBe('function');
});

test('a default that does not match its type is reported, and tuning is off for that id', async () => {
  const { BROKEN_ACCENT } = await import('./problems/broken-defaults');
  const entries = await renderHook(() => useTunables());

  expect(errors).toContainEqual([tunerProblem('broken.accent', `${DEFAULTS_FILE}:3`)]);
  expect(BROKEN_ACCENT).toBe('#zzz');
  expect(entries.result.current.map((entry) => entry.id)).not.toContain('broken.accent');
});

test.each([
  ['broken.empty-steps', 4],
  ['broken.ratio', 5],
])('%s has a default whose type cannot be inferred, so it is reported and not tunable', async (id, line) => {
  const control = await renderHook(() => useTunable(id, isAnything, undefined));

  expect(errors).toContainEqual([tunerProblem(id, `${DEFAULTS_FILE}:${line}`)]);
  expect(control.result.current.entry).toBeNull();
});

test('a problem is printed once, even when its call runs again', async () => {
  const reported = silenceConsole('error');
  await import('./problems/repeated-problem');
  const variant = await renderHook(() => useTunable('broken.variant', isNumber, Number.NaN));

  await variant.act(() => variant.result.current.onValueChange(2));
  await variant.act(() => variant.result.current.onValueChange(3));

  const reports = reported.mock.calls.filter(([message]) => String(message).includes("'broken.on-close'"));
  expect(reports).toHaveLength(1);
});

test('a derived constant that throws keeps its last value, reports the problem and never throws to the writer', async () => {
  const reported = silenceConsole('error');
  const shares = await import('./problems/throwing-derived');
  const count = await renderHook(() => useTunable('broken.share-count', isNumber, Number.NaN));
  let accepted = false;

  await count.act(() => {
    accepted = count.result.current.onValueChange(0);
  });
  const afterThrow = shares.SHARE;
  await count.act(() => count.result.current.onValueChange(4));

  expect(reported).toHaveBeenCalledWith(
    expect.stringMatching(
      /^\[tuner\] .*src\/lib\/tuner\/browser-tests\/constants\/problems\/throwing-derived\.ts#SHARE/
    ),
    expect.any(RangeError)
  );
  expect([accepted, afterThrow, shares.SHARE]).toEqual([true, 50, 25]);
});
