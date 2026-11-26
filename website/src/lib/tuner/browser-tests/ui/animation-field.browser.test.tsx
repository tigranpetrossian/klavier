import { beforeEach, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { clearTuning, renderSession } from '../support/harness';
import { focusAndPress, InPanel, openPanel } from '../support/panel-harness';
import { isAnimation, type Animation } from '@/lib/tuner/animation';
import { useTunable } from '@/lib/tuner/react';
import { AnimationField, ResetButton, Row, Section } from '@/lib/tuner/ui';
import './animation-field/animation-config';

type Screen = Awaited<ReturnType<typeof render>>;

const FALLBACK: Animation = { type: 'easing', duration: 200, bezier: [0.25, 0.1, 0.25, 1], delay: 0 };
const EASING_SQUARE = 104;
const EASING_FAR_ABOVE_THE_CURVE = 1.9;
const PAST_ROUNDED_CORNER = 40;
const SLOW_SPRING_AFTER_TWO_SECONDS = 0.0785;

beforeEach(clearTuning);

test('the toggle shows the label and a summary of the value', async () => {
  await renderSession();
  const screen = await renderAnimation();

  await expect.element(toggle(screen)).toHaveTextContent('EnterSpring · 112 | 24 | 1');
});

test('the editor opens against the outer edge of the panel, on the spring tab with its fields', async () => {
  await page.viewport(1200, 800);
  await renderSession();
  const screen = await renderAnimation();

  await toggle(screen).click();

  const editor = screen.getByRole('dialog', { name: 'Enter' });
  await expect.element(editor).toBeVisible();
  await expect.element(screen.getByRole('button', { name: 'Spring' })).toHaveAttribute('aria-pressed', 'true');
  await expect.element(screen.getByRole('slider', { name: 'Stiffness' })).toHaveValue('112');
  await expect.element(screen.getByText(/^\d+ms settle$/)).toBeVisible();
  const panel = toggle(screen).element().closest('.tuner-Panel');
  expect(editor.element().getBoundingClientRect().right).toBe(panel?.getBoundingClientRect().left);
});

test('switching type converts the value as one undo step, and switching back restores what was edited', async () => {
  const session = await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();

  await screen.getByRole('button', { name: 'Time' }).click();
  const asTime = summaryOf(screen);
  await screen.getByRole('button', { name: 'Spring' }).click();
  const backToSpring = summaryOf(screen);
  await session.act(() => session.result.current.undo());

  expect([asTime, backToSpring, summaryOf(screen)]).toEqual([
    'Duration · 495ms | 0',
    'Spring · 112 | 24 | 1',
    'Duration · 495ms | 0',
  ]);
});

test('holding an arrow key on a field is one undo step', async () => {
  const session = await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();

  await focusAndPress(screen.getByRole('slider', { name: 'Damping' }).element(), '{ArrowRight>3}{/ArrowRight}');
  const edited = summaryOf(screen);
  await session.act(() => session.result.current.undo());

  expect([edited, summaryOf(screen)]).toEqual(['Spring · 112 | 27 | 1', 'Spring · 112 | 24 | 1']);
});

test('an easing takes its curve from a preset', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  await screen.getByRole('button', { name: 'Easing' }).click();

  await screen.getByRole('combobox', { name: 'Curve' }).click();
  await screen.getByRole('option', { name: 'Ease in', exact: true }).click();

  expect(summaryOf(screen)).toBe('Ease · cubic-bezier(.42,0,1,1)');
});

test('the curve is drawn in a 256 by 128 box on every tab', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  const sizes: number[][] = [];

  for (const tab of ['Spring', 'Time', 'Easing']) {
    await screen.getByRole('button', { name: tab }).click();
    const box = editorPart(screen, '.tuner-AnimationCurveGraph').getBoundingClientRect();
    sizes.push([box.width, box.height]);
  }

  expect(sizes).toEqual([
    [256, 128],
    [256, 128],
    [256, 128],
  ]);
});

test('the easing curve is drawn in a square in the middle of the box', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  await screen.getByRole('button', { name: 'Easing' }).click();
  const graph = editorPart(screen, '.tuner-AnimationCurveGraph').getBoundingClientRect();
  const curve = editorPart(screen, '.tuner-AnimationCurveLine').getBoundingClientRect();

  expect([curve.width, curve.height]).toEqual([EASING_SQUARE, EASING_SQUARE]);
  expect([curve.left - graph.left, curve.top - graph.top]).toEqual([
    (graph.width - EASING_SQUARE) / 2,
    (graph.height - EASING_SQUARE) / 2,
  ]);
});

test('an easing handle drags past the curve, down to -1 and up towards 2, while the graph zooms out to keep it in the box', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  await screen.getByRole('button', { name: 'Easing' }).click();
  const editor = editorPart(screen, '.tuner-PanelPopoverBody').parentElement;
  const graph = editorPart(screen, '.tuner-AnimationCurveGraph');
  const [start, end] = editorParts(screen, '.tuner-AnimationCurveHandle');
  if (editor === null) throw new Error('The editor has no popup');

  await userEvent.dragAndDrop(end, editor, { targetPosition: { x: PAST_ROUNDED_CORNER, y: 1 } });
  await userEvent.dragAndDrop(start, editor, {
    targetPosition: { x: editor.clientWidth - PAST_ROUNDED_CORNER, y: editor.clientHeight - 1 },
  });

  const [x1, y1, x2, y2] = bezierOf(screen);
  expect([x1, y1, x2]).toEqual([1, -1, 0]);
  expect(y2).toBeGreaterThan(EASING_FAR_ABOVE_THE_CURVE);
  expect([start, end].every((handle) => isInside(handle, graph))).toBe(true);
});

test('dragging an easing handle is one undo step', async () => {
  const session = await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  await screen.getByRole('button', { name: 'Easing' }).click();
  const graph = editorPart(screen, '.tuner-AnimationCurveGraph');
  const [, end] = editorParts(screen, '.tuner-AnimationCurveHandle');

  await userEvent.dragAndDrop(end, graph, { targetPosition: { x: 128, y: 64 } });
  const dragged = summaryOf(screen);
  await session.act(() => session.result.current.undo());

  expect([dragged, summaryOf(screen)]).toEqual([
    'Ease · cubic-bezier(.25,.1,.5,.5)',
    'Ease · cubic-bezier(.25,.1,.25,1)',
  ]);
});

test('switching to the easing tab and then dragging its curve are two undo steps', async () => {
  const session = await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  await screen.getByRole('button', { name: 'Easing' }).click();
  const switched = summaryOf(screen);
  const graph = editorPart(screen, '.tuner-AnimationCurveGraph');
  const [, end] = editorParts(screen, '.tuner-AnimationCurveHandle');
  await userEvent.dragAndDrop(end, graph, { targetPosition: { x: 128, y: 64 } });
  const dragged = summaryOf(screen);
  const undone: (string | null)[] = [];

  for (let undo = 0; undo < 2; undo++) {
    await session.act(() => session.result.current.undo());
    undone.push(summaryOf(screen));
  }

  expect(dragged).not.toBe(switched);
  expect(undone).toEqual([switched, 'Spring · 112 | 24 | 1']);
});

test('a spring is drawn over two seconds, so a slow one stops short of its end', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  const settledInTime = curveEndHeight(screen);

  await focusAndPress(screen.getByRole('slider', { name: 'Stiffness' }).element(), '{Home}');

  expect(settledInTime).toBeCloseTo(1, 2);
  expect(curveEndHeight(screen)).toBeCloseTo(SLOW_SPRING_AFTER_TWO_SECONDS, 2);
});

test('a time animation cannot be shorter than 100ms', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  await screen.getByRole('button', { name: 'Time' }).click();

  await focusAndPress(screen.getByRole('slider', { name: 'Duration' }).element(), '{Home}');

  expect(summaryOf(screen)).toBe('Duration · 100ms | 0');
});

test('a quick time animation becomes the same spring scaled into the ranges of the fields', async () => {
  await renderSession();
  const screen = await renderAnimation('ui.quick', 'Quick');
  await toggle(screen, 'Quick').click();
  const settleAsTime = settleCaption(screen);

  await screen.getByRole('button', { name: 'Spring' }).click();

  expect(summaryOf(screen, 'Quick')).toBe('Spring · 1000 | 26.74 | 0.36');
  expect(Math.abs(settleCaption(screen) - settleAsTime)).toBeLessThan(2);
});

test('an easing shorter than 100ms becomes a 100ms time animation', async () => {
  await renderSession();
  const screen = await renderAnimation('ui.blink', 'Blink');
  await toggle(screen, 'Blink').click();

  await screen.getByRole('button', { name: 'Time' }).click();

  expect(summaryOf(screen, 'Blink')).toBe('Duration · 100ms | 0');
  await expect.element(screen.getByRole('slider', { name: 'Duration' })).toHaveValue('100');
});

test('a spring too slow to settle in ten seconds shows its settle time in seconds', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();

  await focusAndPress(screen.getByRole('slider', { name: 'Stiffness' }).element(), '{Home}');
  await focusAndPress(screen.getByRole('slider', { name: 'Damping' }).element(), '{End}');

  await expect.element(screen.getByText('529.8s settle')).toBeVisible();
});

test('double-clicking a field thumb resets that field to the default', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  const stiffness = screen.getByRole('slider', { name: 'Stiffness' });
  await focusAndPress(stiffness.element(), '{ArrowRight}{ArrowRight}');
  await focusAndPress(screen.getByRole('slider', { name: 'Mass' }).element(), '{ArrowRight}');
  const thumb = stiffness.element().closest('.fp-SliderThumb');
  if (!(thumb instanceof HTMLElement)) throw new Error('The slider has no thumb');

  await userEvent.dblClick(thumb);

  expect(summaryOf(screen)).toBe('Spring · 112 | 24 | 1.1');
});

test('the reset button resets the whole animation', async () => {
  await renderSession();
  const screen = await renderAnimation();
  await toggle(screen).click();
  await screen.getByRole('button', { name: 'Time' }).click();
  await userEvent.keyboard('{Escape}');

  await screen.getByLabelText('Reset').click();

  expect(summaryOf(screen)).toBe('Spring · 112 | 24 | 1');
});

async function renderAnimation(id = 'ui.enter', label = 'Enter') {
  const screen = await render(
    <InPanel>
      <BoundAnimation id={id} label={label} />
    </InPanel>
  );
  await openPanel();
  return screen;
}

function toggle(screen: Screen, label = 'Enter') {
  return screen.getByRole('button', { name: new RegExp(`^${label}`) });
}

function summaryOf(screen: Screen, label = 'Enter'): string | null {
  return toggle(screen, label).element().querySelector('.tuner-PopoverToggleSummary')?.textContent ?? null;
}

function bezierOf(screen: Screen): number[] {
  const numbers = summaryOf(screen)?.match(/\((.*)\)/)?.[1] ?? '';
  return numbers.split(',').map(Number);
}

function curveEndHeight(screen: Screen): number {
  const curve = editorPart(screen, '.tuner-AnimationCurveLine');
  if (!(curve instanceof SVGPathElement)) throw new Error('The curve is not a path');
  const end = curve.getPointAtLength(curve.getTotalLength()).y;
  const base = levelOf(screen, '.tuner-AnimationCurveBase');
  return (base - end) / (base - levelOf(screen, '.tuner-AnimationCurveTarget'));
}

function levelOf(screen: Screen, selector: string): number {
  return Number(editorPart(screen, selector).getAttribute('y1'));
}

function isInside(part: Element, container: Element): boolean {
  const box = part.getBoundingClientRect();
  const bounds = container.getBoundingClientRect();
  return box.top >= bounds.top && box.bottom <= bounds.bottom && box.left >= bounds.left && box.right <= bounds.right;
}

function settleCaption(screen: Screen): number {
  return Number.parseFloat(editorPart(screen, '.tuner-AnimationCurveCaption').textContent ?? '');
}

function editorPart(screen: Screen, selector: string): Element {
  const [part] = editorParts(screen, selector);
  if (part === undefined) throw new Error(`The editor has no ${selector}`);
  return part;
}

function editorParts(screen: Screen, selector: string): Element[] {
  const editor = screen.getByRole('button', { name: 'Easing' }).element().closest('.tuner-AnimationPopover');
  return [...(editor?.querySelectorAll(selector) ?? [])];
}

function BoundAnimation({ id, label }: { id: string; label: string }) {
  const animation = useTunable(id, isAnimation, FALLBACK);
  return (
    <Section.Root>
      <Section.Header>
        <Section.Title>Motion</Section.Title>
      </Section.Header>
      <Section.Body>
        <Row.Root>
          <Row.Field span={2}>
            <AnimationField {...animation} label={label} />
          </Row.Field>
          <Row.Rail>
            <ResetButton {...animation} />
          </Row.Rail>
        </Row.Root>
      </Section.Body>
    </Section.Root>
  );
}
