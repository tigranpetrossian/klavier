import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { renderSession, tunerProblem } from '../support/harness';
import { clearPropertyTuning, renderProperty, serveStylesheet } from '../support/property-harness';
import duplicatesA from './problems/duplicates-a.css?raw';
import duplicatesB from './problems/duplicates-b.css?raw';
import references from './problems/references.css?raw';
import variants from './served/variants.css?raw';

const REFERENCES_FILE = 'src/lib/tuner/browser-tests/properties/problems/references.css';
const DUPLICATES_A = 'src/lib/tuner/browser-tests/properties/problems/duplicates-a.css';
const DUPLICATES_B = 'src/lib/tuner/browser-tests/properties/problems/duplicates-b.css';
const VARIANTS_FILE = 'src/lib/tuner/browser-tests/properties/problems/variants.css';

const warnings: unknown[] = [];
const errors: unknown[] = [];

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation((message: unknown) => {
    warnings.push(message);
  });
  vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
    errors.push(message);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(clearPropertyTuning);

test('a reference to a property declared nowhere is reported, and resolves to null', async () => {
  serveStylesheet(references);
  await renderSession();

  const broken = await renderProperty('--broken');

  await expect
    .poll(() => broken.result.current.entry)
    .toMatchObject({ presence: 'applied', form: 'reference', target: '--missing', resolved: null });
  expect(warnings).toContainEqual(tunerProblem('--broken|:root', `${REFERENCES_FILE}:2`));
});

test('a stylesheet the dev server cannot parse is reported with its reason', async () => {
  await renderSession();

  await expect
    .poll(() => warnings)
    .toContainEqual(expect.stringMatching(/^\[tuner\] .*problems\/broken\.css.*Unclosed block/));
});

test('when one name and context is declared more than once, only the cascade winner is tunable and the others are reported', async () => {
  serveStylesheet('@layer base, components;');
  serveStylesheet(duplicatesA);
  serveStylesheet(duplicatesB);
  await renderSession();

  const radius = await renderProperty('--radius');
  const gap = await renderProperty('--gap');
  const pad = await renderProperty('--pad', '.card');
  const layered = await renderProperty('--layered');

  await expect
    .poll(() => [radius, gap, pad, layered].map((property) => property.result.current.entry?.location))
    .toEqual([
      { file: DUPLICATES_B, line: 2 },
      { file: DUPLICATES_A, line: 3 },
      { file: DUPLICATES_A, line: 11 },
      { file: DUPLICATES_A, line: 16 },
    ]);
  expect(errors).toEqual(
    expect.arrayContaining([
      tunerProblem('--radius|:root', `${DUPLICATES_A}:2`),
      tunerProblem('--gap|:root', `${DUPLICATES_B}:7`),
      tunerProblem('--pad|.card', `${DUPLICATES_A}:7`),
      tunerProblem('--layered|:root', `${DUPLICATES_B}:13`),
    ])
  );
});

test('a declaration in an at-rule the tuner does not understand, with no unique match on the page, is reported and absent', async () => {
  serveStylesheet(variants);
  await renderSession();

  const hover = await renderProperty('--chip', '@variant hover .chip');

  await expect.poll(() => hover.result.current.entry?.presence).toBe('absent');
  expect(warnings).toEqual(
    expect.arrayContaining([
      tunerProblem('--chip|@variant hover .chip', `${VARIANTS_FILE}:3`),
      tunerProblem('--chip|@variant focus .chip', `${VARIANTS_FILE}:7`),
    ])
  );
});
