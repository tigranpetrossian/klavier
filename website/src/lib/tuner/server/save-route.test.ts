import { afterEach, describe, expect, test, vi } from 'vitest';
import { POST } from './save-route.ts';
import { createProject, postJson, postText, removeProjects } from './temp-project.ts';
import path from 'node:path';
import fs from 'node:fs/promises';

const URL_PATH = '/api/tuner/save';

afterEach(removeProjects);

describe('POST /api/tuner/save', () => {
  describe('declarations', () => {
    test('replaces the value of a declaration', async () => {
      const project = await createProject({
        'src/app/globals.css': ':root {\n  --accent: #0d99ff;\n}\n',
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [property('--accent', ':root', 'src/app/globals.css', '#ff0000', '#0d99ff')],
        })
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        saved: ['--accent|:root'],
        skipped: [],
      });
      expect(await project.read('src/app/globals.css')).toBe(':root {\n  --accent: #ff0000;\n}\n');
    });

    test('replaces only the value and keeps !important, comments and a missing final semicolon', async () => {
      const project = await createProject({
        'src/app/globals.css': [
          '@theme {',
          '  --color-brand: #0d99ff; /* brand */',
          '}',
          ':root {',
          '  --commented: /* note */ 4px /* px */;',
          '  --important:2px   !important;',
          '  --stack: Inter,',
          '    system-ui,',
          '    sans-serif;',
          '  --last: 1px',
          '}',
          '.card { &:hover { --lift: 2px; } }',
          '@media (prefers-color-scheme: dark) {',
          '  :root { --accent: #111; }',
          '}',
          '',
        ].join('\n'),
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            property('--color-brand', ':root', 'src/app/globals.css', '#ff0000', '#0d99ff'),
            property('--commented', ':root', 'src/app/globals.css', '5px', '4px'),
            property('--important', ':root', 'src/app/globals.css', '3px', '2px'),
            property(
              '--stack',
              ':root',
              'src/app/globals.css',
              'Geist, sans-serif',
              'Inter,\n    system-ui,\n    sans-serif'
            ),
            property('--last', ':root', 'src/app/globals.css', '2px', '1px'),
            property('--lift', '.card:hover', 'src/app/globals.css', '4px', '2px'),
            property('--accent', '@media (prefers-color-scheme: dark) :root', 'src/app/globals.css', '#222', '#111'),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: [
          '--color-brand|:root',
          '--commented|:root',
          '--important|:root',
          '--stack|:root',
          '--last|:root',
          '--lift|.card:hover',
          '--accent|@media (prefers-color-scheme: dark) :root',
        ],
        skipped: [],
      });
      expect(await project.read('src/app/globals.css')).toBe(
        [
          '@theme {',
          '  --color-brand: #ff0000; /* brand */',
          '}',
          ':root {',
          '  --commented: /* note */ 5px /* px */;',
          '  --important:3px   !important;',
          '  --stack: Geist, sans-serif;',
          '  --last: 2px',
          '}',
          '.card { &:hover { --lift: 4px; } }',
          '@media (prefers-color-scheme: dark) {',
          '  :root { --accent: #222; }',
          '}',
          '',
        ].join('\n')
      );
    });

    test('edits only the declaration whose context matches when the name repeats', async () => {
      const project = await createProject({
        'src/app/globals.css': [
          '@theme inline {',
          '  --font-sans: var(--font-geist);',
          '}',
          ':root {',
          '  --background: #fff;',
          '}',
          '.dark {',
          '  --background: #000;',
          '}',
          '@layer components {',
          '  .a,',
          '  .b {',
          '    &:hover {',
          '      --background: #eee;',
          '    }',
          '  }',
          '}',
          '',
        ].join('\n'),
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            property('--background', '.dark', 'src/app/globals.css', '#111', '#000'),
            property('--background', ':is(.a, .b):hover', 'src/app/globals.css', '#ddd', '#eee'),
            property('--font-sans', ':root', 'src/app/globals.css', 'var(--font-inter)', 'var(--font-geist)'),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['--background|.dark', '--background|:is(.a, .b):hover', '--font-sans|:root'],
        skipped: [],
      });
      expect(await project.read('src/app/globals.css')).toBe(
        [
          '@theme inline {',
          '  --font-sans: var(--font-inter);',
          '}',
          ':root {',
          '  --background: #fff;',
          '}',
          '.dark {',
          '  --background: #111;',
          '}',
          '@layer components {',
          '  .a,',
          '  .b {',
          '    &:hover {',
          '      --background: #ddd;',
          '    }',
          '  }',
          '}',
          '',
        ].join('\n')
      );
    });

    test('skips a declaration that is missing, duplicated or changed since and saves the others', async () => {
      const project = await createProject({
        'src/app/globals.css': ':root {\n  --gap: 4px;\n  --gap: 6px;\n  --radius: 8px;\n  --accent: #000;\n}\n',
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            property('--missing', ':root', 'src/app/globals.css', '1px', '2px'),
            property('--gap', ':root', 'src/app/globals.css', '5px', '6px'),
            property('--radius', ':root', 'src/app/globals.css', '10px', '9px'),
            property('--accent', ':root', 'src/app/globals.css', '#fff', '#000'),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['--accent|:root'],
        skipped: [
          { id: '--missing|:root', reason: 'Not found in the file' },
          { id: '--gap|:root', reason: 'Appears more than once in the file' },
          {
            id: '--radius|:root',
            reason: 'The file changed since the page loaded',
          },
        ],
      });
      expect(await project.read('src/app/globals.css')).toBe(
        ':root {\n  --gap: 4px;\n  --gap: 6px;\n  --radius: 8px;\n  --accent: #fff;\n}\n'
      );
    });
  });

  describe('constants', () => {
    test('replaces a number default', async () => {
      const project = await createProject({
        'src/config.ts':
          "import { tunable } from '@/lib/tuner/tunable';\n\nexport const LIMIT = tunable('toasts.limit', 3);\n",
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [constant('toasts.limit', 'src/config.ts', 5, 3)],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['toasts.limit'],
        skipped: [],
      });
      expect(await project.read('src/config.ts')).toBe(
        "import { tunable } from '@/lib/tuner/tunable';\n\nexport const LIMIT = tunable('toasts.limit', 5);\n"
      );
    });

    test('keeps the quote style of the string it replaces', async () => {
      const project = await createProject({
        'src/single.ts': "const MODE = tunable<Mode>('toasts.mode', 'stack');\n",
        'src/double.ts': 'const LABEL = tunable("card.label", "Hello")\n',
        'src/mixed.ts': 'const SIDE = tunable("toasts.side", \'left\')\n',
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            constant('toasts.mode', 'src/single.ts', 'it\'s "fanned"', 'stack'),
            constant('card.label', 'src/double.ts', 'Say "hi"\n', 'Hello'),
            constant('toasts.side', 'src/mixed.ts', 'right', 'left'),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['toasts.mode', 'card.label', 'toasts.side'],
        skipped: [],
      });
      expect(await project.read('src/single.ts')).toBe(
        "const MODE = tunable<Mode>('toasts.mode', 'it\\'s \"fanned\"');\n"
      );
      expect(await project.read('src/double.ts')).toBe('const LABEL = tunable("card.label", "Say \\"hi\\"\\n")\n');
      expect(await project.read('src/mixed.ts')).toBe('const SIDE = tunable("toasts.side", \'right\')\n');
    });

    test('replaces negative numbers, booleans and null', async () => {
      const project = await createProject({
        'src/config.ts': [
          "const OFFSET = tunable('offset', -4);",
          "const SHIFT = tunable('shift', 2);",
          "const OPEN = tunable('open', true);",
          "const ACCENT = tunable<Color | null>('accent', null);",
          '',
        ].join('\n'),
      });

      await POST(
        postJson(URL_PATH, {
          values: [
            constant('offset', 'src/config.ts', 2, -4),
            constant('shift', 'src/config.ts', -6, 2),
            constant('open', 'src/config.ts', false, true),
            constant('accent', 'src/config.ts', '#0d99ff', null),
          ],
        })
      );

      expect(await project.read('src/config.ts')).toBe(
        [
          "const OFFSET = tunable('offset', 2);",
          "const SHIFT = tunable('shift', -6);",
          "const OPEN = tunable('open', false);",
          "const ACCENT = tunable<Color | null>('accent', '#0d99ff');",
          '',
        ].join('\n')
      );
    });

    test('replaces only the fields that changed inside objects and arrays', async () => {
      const project = await createProject({
        'src/toasts.tsx': [
          "export const TOAST = tunable('toast', {",
          '  gap: 8, // between toasts',
          "  'max-width': 320,",
          "  positions: ['top', /* fallback */ 'bottom'],",
          '} as const);',
          '',
          'export function Toasts() {',
          '  return <div style={{ gap: TOAST.gap }} />;',
          '}',
          '',
        ].join('\n'),
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            constant(
              'toast',
              'src/toasts.tsx',
              { gap: 12, 'max-width': 320, positions: ['top', 'left'] },
              { gap: 8, 'max-width': 320, positions: ['top', 'bottom'] }
            ),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['toast'],
        skipped: [],
      });
      expect(await project.read('src/toasts.tsx')).toBe(
        [
          "export const TOAST = tunable('toast', {",
          '  gap: 12, // between toasts',
          "  'max-width': 320,",
          "  positions: ['top', /* fallback */ 'left'],",
          '} as const);',
          '',
          'export function Toasts() {',
          '  return <div style={{ gap: TOAST.gap }} />;',
          '}',
          '',
        ].join('\n')
      );
    });

    test('keeps parentheses, as const and satisfies around the default', async () => {
      const project = await createProject({
        'src/config.ts': "const STEPS = tunable('steps', ([1, 2] as const) satisfies readonly number[]);\n",
      });

      await POST(
        postJson(URL_PATH, {
          values: [constant('steps', 'src/config.ts', [1, 3], [1, 2])],
        })
      );

      expect(await project.read('src/config.ts')).toBe(
        "const STEPS = tunable('steps', ([1, 3] as const) satisfies readonly number[]);\n"
      );
    });

    test('writes a whole array or object in the file style when its shape changes', async () => {
      const project = await createProject({
        'src/config.ts': [
          "const STOPS = tunable('stops', ['#000', '#fff']);",
          'const SIZES = tunable("sizes", { "sm": 4 });',
          '',
        ].join('\n'),
      });

      await POST(
        postJson(URL_PATH, {
          values: [
            constant('stops', 'src/config.ts', ['#000', '#888', '#fff'], ['#000', '#fff']),
            constant('sizes', 'src/config.ts', { sm: 4, lg: 16, 'x-l': 24 }, { sm: 4 }),
          ],
        })
      );

      expect(await project.read('src/config.ts')).toBe(
        [
          "const STOPS = tunable('stops', ['#000', '#888', '#fff']);",
          'const SIZES = tunable("sizes", { "sm": 4, "lg": 16, "x-l": 24 });',
          '',
        ].join('\n')
      );
    });

    test('skips a constant that is missing, duplicated, computed or changed since and saves the others', async () => {
      const project = await createProject({
        'src/config.ts': [
          "const A = tunable('dup', 1);",
          "const B = tunable('dup', 1);",
          "const C = tunable('computed', BASE * 2);",
          "const D = tunable('changed', 4);",
          "const E = tunable('kept', 1);",
          '',
        ].join('\n'),
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            constant('missing', 'src/config.ts', 2, 1),
            constant('dup', 'src/config.ts', 2, 1),
            constant('computed', 'src/config.ts', 3, 2),
            constant('changed', 'src/config.ts', 5, 3),
            constant('kept', 'src/config.ts', 2, 1),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['kept'],
        skipped: [
          { id: 'missing', reason: 'Not found in the file' },
          { id: 'dup', reason: 'Appears more than once in the file' },
          {
            id: 'computed',
            reason: 'The default in the file is not a literal',
          },
          { id: 'changed', reason: 'The file changed since the page loaded' },
        ],
      });
      expect(await project.read('src/config.ts')).toBe(
        [
          "const A = tunable('dup', 1);",
          "const B = tunable('dup', 1);",
          "const C = tunable('computed', BASE * 2);",
          "const D = tunable('changed', 4);",
          "const E = tunable('kept', 2);",
          '',
        ].join('\n')
      );
    });
  });

  describe('formatting', () => {
    test('formats a file after the edit when it was formatted before', async () => {
      const project = await createProject({
        '.prettierrc': '{ "singleQuote": true }\n',
        'src/config.ts': "export const SIZES = tunable('sizes', { sm: 4 });\n",
        'src/app/globals.css': ':root {\n  --font: Inter, sans-serif;\n  --accent: #0d99ff;\n}\n',
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            constant('sizes', 'src/config.ts', { sm: 4, md: 8, lg: 16, xl: 24, xxl: 32, huge: 64 }, { sm: 4 }),
            property('--font', ':root', 'src/app/globals.css', 'Geist,sans-serif', 'Inter, sans-serif'),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['sizes', '--font|:root'],
        skipped: [],
      });
      expect(await project.read('src/config.ts')).toBe(
        "export const SIZES = tunable('sizes', {\n  sm: 4,\n  md: 8,\n  lg: 16,\n  xl: 24,\n  xxl: 32,\n  huge: 64,\n});\n"
      );
      expect(await project.read('src/app/globals.css')).toBe(
        ':root {\n  --font: Geist, sans-serif;\n  --accent: #0d99ff;\n}\n'
      );
    });

    test('leaves a file unformatted when it was not formatted before', async () => {
      const project = await createProject({
        '.prettierrc': '{ "singleQuote": true }\n',
        'src/config.ts': 'export const SIZES = tunable("sizes", {sm: 4})\n',
        'src/app/globals.css': ':root{--font:Inter,sans-serif}\n',
      });

      await POST(
        postJson(URL_PATH, {
          values: [
            constant('sizes', 'src/config.ts', { sm: 4, md: 8, lg: 16, xl: 24, xxl: 32, huge: 64 }, { sm: 4 }),
            property('--font', ':root', 'src/app/globals.css', 'Geist,sans-serif', 'Inter,sans-serif'),
          ],
        })
      );

      expect(await project.read('src/config.ts')).toBe(
        'export const SIZES = tunable("sizes", { sm: 4, md: 8, lg: 16, xl: 24, xxl: 32, huge: 64 })\n'
      );
      expect(await project.read('src/app/globals.css')).toBe(':root{--font:Geist,sans-serif}\n');
    });
  });

  describe('safety', () => {
    test('leaves the file unchanged when an edit does not read back and saves other files', async () => {
      const project = await createProject({
        'src/app/globals.css': ':root {\n  --accent: #000;\n  --gap: 4px;\n}\n',
        'src/app/other.css': ':root {\n  --radius: 2px;\n}\n',
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            property('--gap', ':root', 'src/app/globals.css', '8px', '4px'),
            property('--accent', ':root', 'src/app/globals.css', 'red; --injected: 1', '#000'),
            property('--radius', ':root', 'src/app/other.css', '6px', '2px'),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['--radius|:root'],
        skipped: [
          {
            id: '--gap|:root',
            reason: 'The edit could not be read back, so the file was left unchanged',
          },
          {
            id: '--accent|:root',
            reason: 'The edit could not be read back, so the file was left unchanged',
          },
        ],
      });
      expect(await project.read('src/app/globals.css')).toBe(':root {\n  --accent: #000;\n  --gap: 4px;\n}\n');
      expect(await project.read('src/app/other.css')).toBe(':root {\n  --radius: 6px;\n}\n');
    });

    test('skips values in files that do not parse', async () => {
      const project = await createProject({
        'src/config.ts': "const LIMIT = tunable('limit', 3\n",
      });

      const response = await POST(
        postJson(URL_PATH, {
          values: [constant('limit', 'src/config.ts', 4, 3)],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: [],
        skipped: [{ id: 'limit', reason: 'The file does not parse' }],
      });
      expect(await project.read('src/config.ts')).toBe("const LIMIT = tunable('limit', 3\n");
    });

    test('writes only files under the source directory', async () => {
      const outside = await createProject({
        'shared/tokens.css': ':root {\n  --far: 1px;\n}\n',
      });
      const project = await createProject({
        'styles/tokens.css': ':root {\n  --near: 1px;\n}\n',
        'src/app/globals.css': ':root {\n  --kept: 1px;\n}\n',
      });
      await fs.symlink(path.join(project.root, 'styles/tokens.css'), path.join(project.root, 'src/app/linked.css'));

      const response = await POST(
        postJson(URL_PATH, {
          values: [
            property('--near', ':root', 'src/../styles/tokens.css', '2px', '1px'),
            property('--near', ':root', 'src/app/linked.css', '2px', '1px'),
            property('--far', ':root', path.join(outside.root, 'shared/tokens.css'), '2px', '1px'),
            property('--far', ':root', '../' + path.basename(outside.root) + '/shared/tokens.css', '2px', '1px'),
            property('--kept', ':root', 'src/app/globals.css', '2px', '1px'),
          ],
        })
      );

      expect(await response.json()).toEqual({
        ok: true,
        saved: ['--kept|:root'],
        skipped: [
          {
            id: '--near|:root',
            reason: 'The file is not under the source directory',
          },
          {
            id: '--near|:root',
            reason: 'The file is not under the source directory',
          },
          {
            id: '--far|:root',
            reason: 'The file is not under the source directory',
          },
          {
            id: '--far|:root',
            reason: 'The file is not under the source directory',
          },
        ],
      });
      expect(await project.read('styles/tokens.css')).toBe(':root {\n  --near: 1px;\n}\n');
      expect(await outside.read('shared/tokens.css')).toBe(':root {\n  --far: 1px;\n}\n');
    });

    test.skipIf(process.getuid?.() === 0)(
      'skips the values of a file that cannot be written and leaves no temporary files',
      async () => {
        const project = await createProject({
          'src/app/globals.css': ':root {\n  --gap: 4px;\n}\n',
        });
        const directory = path.join(project.root, 'src/app');
        await fs.chmod(directory, 0o555);

        const response = await POST(
          postJson(URL_PATH, {
            values: [property('--gap', ':root', 'src/app/globals.css', '8px', '4px')],
          })
        );
        await fs.chmod(directory, 0o755);

        expect(await response.json()).toEqual({
          ok: true,
          saved: [],
          skipped: [{ id: '--gap|:root', reason: 'The file cannot be written' }],
        });
        expect(await project.read('src/app/globals.css')).toBe(':root {\n  --gap: 4px;\n}\n');
        expect(await fs.readdir(directory)).toEqual(['globals.css']);
      }
    );

    test('leaves no temporary files next to a saved file', async () => {
      const project = await createProject({
        'src/app/globals.css': ':root {\n  --gap: 4px;\n}\n',
      });

      await POST(
        postJson(URL_PATH, {
          values: [property('--gap', ':root', 'src/app/globals.css', '8px', '4px')],
        })
      );

      expect(await fs.readdir(path.join(project.root, 'src/app'))).toEqual(['globals.css']);
    });
  });

  describe('request failures', () => {
    test('rejects a cross-origin save without touching files', async () => {
      const project = await createProject({
        'src/app/globals.css': ':root {\n  --gap: 4px;\n}\n',
      });

      const response = await POST(
        postJson(
          URL_PATH,
          {
            values: [property('--gap', ':root', 'src/app/globals.css', '8px', '4px')],
          },
          { Origin: 'http://evil.test', 'Sec-Fetch-Site': 'cross-site' }
        )
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        ok: false,
        reason: expect.any(String),
      });
      expect(await project.read('src/app/globals.css')).toBe(':root {\n  --gap: 4px;\n}\n');
    });

    test.each([
      ['not JSON', '{values'],
      ['without values', JSON.stringify({})],
      [
        'with a value of unknown kind',
        JSON.stringify({
          values: [{ kind: 'other', id: 'x', location: { file: 'a', line: 1 } }],
        }),
      ],
      [
        'with a property value that is not a string',
        JSON.stringify({
          values: [{ ...property('--a', ':root', 'src/a.css', '1', '2'), value: 1 }],
        }),
      ],
      [
        'with a constant missing its loaded default',
        JSON.stringify({
          values: [
            {
              kind: 'constant',
              id: 'x',
              location: { file: 'a', line: 1 },
              value: 1,
            },
          ],
        }),
      ],
    ])('fails the whole save when the body is %s', async (_, body) => {
      await createProject({
        'src/app/globals.css': ':root {\n  --gap: 4px;\n}\n',
      });

      const response = await POST(postText(URL_PATH, body));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        ok: false,
        reason: expect.any(String),
      });
    });

    test('fails the whole save when the tuner options are unreadable', async () => {
      const project = await createProject({
        'src/app/globals.css': ':root {\n  --gap: 4px;\n}\n',
      });
      vi.stubEnv(
        'TUNER_OPTIONS',
        JSON.stringify({
          root: 'relative',
          sourceDirectory: 'src',
          exclude: [],
        })
      );

      const response = await POST(
        postJson(URL_PATH, {
          values: [property('--gap', ':root', 'src/app/globals.css', '8px', '4px')],
        })
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        ok: false,
        reason: expect.any(String),
      });
      expect(await project.read('src/app/globals.css')).toBe(':root {\n  --gap: 4px;\n}\n');
    });
  });
});

function constant(id: string, file: string, value: unknown, loadedDefault: unknown) {
  return {
    kind: 'constant',
    id,
    location: { file, line: 1 },
    value,
    loadedDefault,
  };
}

function property(name: string, context: string, file: string, value: string, loadedDefault: string) {
  return {
    kind: 'property',
    id: `${name}|${context}`,
    name,
    context,
    location: { file, line: 1 },
    value,
    loadedDefault,
  };
}
