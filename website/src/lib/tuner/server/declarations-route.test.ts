import { afterEach, describe, expect, test, vi } from 'vitest';
import { GET } from './declarations-route.ts';
import { createProject, ORIGIN, removeProjects, sameOriginGet } from './temp-project.ts';

const URL_PATH = '/api/tuner/declarations';

afterEach(removeProjects);

describe('GET /api/tuner/declarations', () => {
  test('lists a custom property declared in :root', async () => {
    await createProject({
      'src/app/globals.css': ':root {\n  --accent: #0d99ff;\n}\n',
    });

    const response = await GET(sameOriginGet(URL_PATH));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      declarations: [
        {
          id: '--accent|:root',
          name: '--accent',
          context: ':root',
          file: 'src/app/globals.css',
          line: 2,
          value: '#0d99ff',
          important: false,
          selector: ':root',
          conditions: [],
          layer: null,
          theme: null,
          unsupported: [],
          shadowed: false,
        },
      ],
      problems: [],
    });
  });

  test('places Tailwind @theme variables in :root on the theme layer and keeps the params', async () => {
    await createProject({
      'src/app/globals.css': [
        '@import "tailwindcss";',
        '@theme {',
        '  --color-brand: #0d99ff;',
        '}',
        '@theme inline {',
        '  --font-sans: var(--font-geist-sans);',
        '}',
        '',
      ].join('\n'),
    });

    expect(await listDeclarations()).toMatchObject([
      {
        id: '--color-brand|:root',
        context: ':root',
        selector: ':root',
        layer: 'theme',
        theme: [],
        line: 3,
      },
      {
        id: '--font-sans|:root',
        context: ':root',
        selector: ':root',
        layer: 'theme',
        theme: ['inline'],
        line: 6,
      },
    ]);
  });

  test('gives dark-mode declarations their selector and media condition as context', async () => {
    await createProject({
      'src/app/globals.css': [
        '.dark {',
        '  --background: #000;',
        '}',
        '@media (prefers-color-scheme:   dark) {',
        '  :root {',
        '    --background: #111;',
        '  }',
        '}',
        '',
      ].join('\n'),
    });

    expect(await listDeclarations()).toMatchObject([
      {
        id: '--background|.dark',
        context: '.dark',
        selector: '.dark',
        conditions: [],
      },
      {
        id: '--background|@media (prefers-color-scheme: dark) :root',
        context: '@media (prefers-color-scheme: dark) :root',
        selector: ':root',
        conditions: ['@media (prefers-color-scheme: dark)'],
      },
    ]);
  });

  test('resolves nested rules the way Lightning CSS flattens them', async () => {
    await createProject({
      'src/components/card.css': [
        '.card {',
        '  &:hover { --lift: 2px; }',
        '  .title { --size: 1rem; }',
        '  @media (width >= 40rem) { --pad: 2rem; }',
        '}',
        '.a,',
        '.b {',
        '  &:focus, & > .c { --ring: 1px; }',
        '}',
        '',
      ].join('\n'),
    });

    expect(await listDeclarations()).toMatchObject([
      { id: '--lift|.card:hover', selector: '.card:hover' },
      { id: '--size|.card .title', selector: '.card .title' },
      {
        id: '--pad|@media (width >= 40rem) .card',
        selector: '.card',
        conditions: ['@media (width >= 40rem)'],
      },
      {
        id: '--ring|:is(.a, .b):focus, :is(.a, .b) > .c',
        selector: ':is(.a, .b):focus, :is(.a, .b) > .c',
      },
    ]);
  });

  test('reports the layer outside the context', async () => {
    await createProject({
      'src/app/globals.css': '@layer base {\n  :root { --radius: 4px; }\n}\n@layer a { @layer b { .x { --y: 1; } } }\n',
    });

    expect(await listDeclarations()).toMatchObject([
      { id: '--radius|:root', context: ':root', layer: 'base' },
      { id: '--y|.x', context: '.x', layer: 'a.b' },
    ]);
  });

  test('lists wrapping at-rules the tuner does not understand as unsupported conditions', async () => {
    await createProject({
      'src/app/globals.css': '@scope (.card) {\n  :scope { --gap: 8px; }\n}\n',
    });

    expect(await listDeclarations()).toMatchObject([
      {
        id: '--gap|@scope (.card) :scope',
        conditions: ['@scope (.card)'],
        unsupported: ['@scope (.card)'],
      },
    ]);
  });

  test('marks earlier declarations with the same name, context and layer as shadowed', async () => {
    await createProject({
      'src/app/globals.css': [
        ':root { --gap: 4px; }',
        '@layer base { :root { --gap: 6px; } }',
        ':root { --gap: 8px; }',
        '',
      ].join('\n'),
    });

    expect(await listDeclarations()).toMatchObject([
      { id: '--gap|:root', value: '4px', layer: null, shadowed: true },
      { id: '--gap|:root', value: '6px', layer: 'base', shadowed: false },
      { id: '--gap|:root', value: '8px', layer: null, shadowed: false },
    ]);
  });

  test('reads the trimmed source value without comments around it', async () => {
    await createProject({
      'src/app/globals.css': [
        ':root {',
        '  --important:2px   !important;',
        '  --commented: /* before */ 4px /* after */ ;',
        '  --stack: Inter,',
        '    system-ui,',
        '    sans-serif;',
        '  --inner: calc(1px /* one */ + 2px);',
        '  --quoted: "a /* b */ c";',
        '  --last: 1px',
        '}',
        '',
      ].join('\n'),
    });

    expect(await listDeclarations()).toMatchObject([
      { name: '--important', value: '2px', important: true, line: 2 },
      { name: '--commented', value: '4px', important: false, line: 3 },
      {
        name: '--stack',
        value: 'Inter,\n    system-ui,\n    sans-serif',
        line: 4,
      },
      { name: '--inner', value: 'calc(1px /* one */ + 2px)', line: 7 },
      { name: '--quoted', value: '"a /* b */ c"', line: 8 },
      { name: '--last', value: '1px', line: 9 },
    ]);
  });

  test('reads every stylesheet under the source directory except excluded ones', async () => {
    await createProject(
      {
        'src/app/globals.css': ':root { --a: 1; }\n',
        'src/components/b.css': ':root { --b: 2; }\n',
        'src/app/panel/panel.css': ':root { --panel: 3; }\n',
        'styles/outside.css': ':root { --outside: 4; }\n',
        'src/app/page.tsx': 'export default function Page() { return null; }\n',
      },
      { exclude: ['src/app/panel'] }
    );

    expect(await listDeclarations()).toMatchObject([
      { name: '--a', file: 'src/app/globals.css' },
      { name: '--b', file: 'src/components/b.css' },
    ]);
  });

  test('reports a stylesheet that does not parse as a problem and lists the others', async () => {
    await createProject({
      'src/app/broken.css': ':root { --a: 1;\n',
      'src/app/globals.css': ':root { --b: 2; }\n',
    });

    const response = await GET(sameOriginGet(URL_PATH));

    expect(await response.json()).toMatchObject({
      ok: true,
      declarations: [{ name: '--b' }],
      problems: [{ file: 'src/app/broken.css', reason: expect.stringMatching(/\S/) }],
    });
  });

  test('accepts a request whose Origin matches the Host', async () => {
    await createProject({ 'src/app/globals.css': ':root { --a: 1; }\n' });

    const response = await GET(
      new Request(`${ORIGIN}${URL_PATH}`, {
        headers: { Origin: ORIGIN, Host: 'localhost:3000' },
      })
    );

    expect(response.status).toBe(200);
  });

  test.each([
    ['another origin', { Origin: 'http://evil.test', Host: 'localhost:3000' }],
    [
      'an opaque origin',
      {
        Origin: 'null',
        Host: 'localhost:3000',
        'Sec-Fetch-Site': 'same-origin',
      },
    ],
    ['a cross-site fetch without Origin', { Host: 'localhost:3000', 'Sec-Fetch-Site': 'cross-site' }],
    ['no origin information', { Host: 'localhost:3000' }],
  ])('rejects a request from %s', async (_, headers) => {
    await createProject({ 'src/app/globals.css': ':root { --a: 1; }\n' });

    const response = await GET(new Request(`${ORIGIN}${URL_PATH}`, { headers }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      ok: false,
      reason: expect.any(String),
    });
  });

  test.each([
    ['missing', undefined],
    ['not JSON', '{root'],
    ['missing the root', JSON.stringify({ sourceDirectory: 'src', exclude: [] })],
  ])('fails with a reason when the tuner options are %s', async (_, options) => {
    await createProject({ 'src/app/globals.css': ':root { --a: 1; }\n' });
    vi.stubEnv('TUNER_OPTIONS', options);

    const response = await GET(sameOriginGet(URL_PATH));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      reason: expect.any(String),
    });
  });
});

async function listDeclarations(): Promise<unknown> {
  const body: unknown = await (await GET(sameOriginGet(URL_PATH))).json();
  expect(body).toMatchObject({ ok: true });
  return isRecord(body) ? body.declarations : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
