import { beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clearTuning, renderNumber } from '../support/harness';
import { InPanel, openPanel } from '../support/panel-harness';
import '../session/studio/studio-config';

const APPLE_PLATFORM = /Mac|iPhone|iPad/;

beforeEach(clearTuning);

test('Shift+D opens a closed panel and closes an open one', async () => {
  const screen = await renderPage();

  await userEvent.keyboard('{Shift>}D{/Shift}');
  await expect.element(screen.getByLabelText('Tuner field')).toBeVisible();
  await userEvent.keyboard('{Shift>}D{/Shift}');

  await expect.element(screen.getByLabelText('Tuner field')).not.toBeInTheDocument();
});

test('Mod+Z undoes a change and Mod+Shift+Z redoes it', async () => {
  const width = await renderNumber('studio.width');
  await renderPage();
  await openPanel();
  await width.act(() => width.result.current.onValueChange(400));

  await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
  await expect.poll(() => width.result.current.value).toBe(320);
  await userEvent.keyboard('{ControlOrMeta>}{Shift>}z{/Shift}{/ControlOrMeta}');

  await expect.poll(() => width.result.current.value).toBe(400);
});

test('while the panel is closed, Mod+Z leaves changes alone until Shift+D opens it', async () => {
  const width = await renderNumber('studio.width');
  await renderPage();
  await width.act(() => width.result.current.onValueChange(400));
  await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');
  const valueWhileClosed = width.result.current.value;

  await userEvent.keyboard('{Shift>}D{/Shift}{ControlOrMeta>}z{/ControlOrMeta}');

  await expect.poll(() => [valueWhileClosed, width.result.current.value]).toEqual([400, 320]);
});

test('holding Shift+D toggles the panel once, and holding Mod+Z undoes once per key repeat', async () => {
  const width = await renderNumber('studio.width');
  const gap = await renderNumber('studio.gap');
  const screen = await renderPage();
  await width.act(() => width.result.current.onValueChange(400));
  await gap.act(() => gap.result.current.onValueChange(20));
  await width.act(() => width.result.current.onValueChange(410));

  await userEvent.keyboard('{Shift>}{D>2/}{/Shift}');
  await expect.element(screen.getByLabelText('Tuner field')).toBeVisible();
  await userEvent.keyboard('{ControlOrMeta>}{z>3/}{/ControlOrMeta}');

  await expect.poll(() => [width.result.current.value, gap.result.current.value]).toEqual([320, 16]);
});

test('Shift+D in a page text field types a D instead of opening the panel', async () => {
  const screen = await renderPage();
  await screen.getByLabelText('Page field').click();

  await userEvent.keyboard('{Shift>}D{/Shift}');

  await expect.element(screen.getByLabelText('Page field')).toHaveValue('D');
  await expect.element(screen.getByLabelText('Open tuner')).toBeVisible();
});

test.for([
  ['open', openPanel],
  ['closed', leavePanelClosed],
] as const)(
  "Cmd+Z in the page's own text field undoes the typed text, not a tuner change, while the panel is %s",
  async ([, preparePanel]) => {
    const width = await renderNumber('studio.width');
    const screen = await renderPage();
    await preparePanel();
    await width.act(() => width.result.current.onValueChange(400));
    await screen.getByLabelText('Page field').click();
    await userEvent.keyboard('hello');

    await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');

    await expect.element(screen.getByLabelText('Page field')).toHaveValue('');
    expect(width.result.current.value).toBe(400);
  }
);

test("Cmd+Z in one of the tuner's own text fields undoes the tuner change and leaves the typed text", async () => {
  const width = await renderNumber('studio.width');
  const screen = await renderPage();
  await openPanel();
  await width.act(() => width.result.current.onValueChange(400));
  await screen.getByLabelText('Tuner field').click();
  await userEvent.keyboard('hello');

  await userEvent.keyboard('{ControlOrMeta>}z{/ControlOrMeta}');

  await expect.poll(() => width.result.current.value).toBe(320);
  await expect.element(screen.getByLabelText('Tuner field')).toHaveValue('hello');
});

test('Cmd+Z undoes on a non-Latin layout, where the Z key types another letter', async () => {
  const width = await renderNumber('studio.width');
  await renderPage();
  await openPanel();
  await width.act(() => width.result.current.onValueChange(400));

  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'я', code: 'KeyZ', bubbles: true, ...heldModKey() }));

  await expect.poll(() => width.result.current.value).toBe(320);
});

async function renderPage() {
  return render(
    <>
      <input aria-label="Page field" />
      <InPanel>
        <input aria-label="Tuner field" />
      </InPanel>
    </>
  );
}

async function leavePanelClosed(): Promise<void> {}

function heldModKey(): KeyboardEventInit {
  return APPLE_PLATFORM.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };
}
