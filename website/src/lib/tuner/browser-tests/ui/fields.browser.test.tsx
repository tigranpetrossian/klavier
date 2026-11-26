import { beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import { focusAndPress, InPanel, pageValue, openPanel } from '../support/panel-harness';
import { clearPropertyTuning, renderProperty, serveStylesheet } from '../support/property-harness';
import tokens from './fields/tokens.css?raw';
import {
  ColorField,
  CSS_COLOR,
  cssNumber,
  NumberField,
  ResetButton,
  Row,
  SegmentedField,
  SliderField,
} from '@/lib/tuner/ui';
import { useProperty } from '@/lib/tuner/react';

const PX = cssNumber('px');
const EM = cssNumber('em');
const ALIGNMENTS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

beforeEach(async () => {
  serveStylesheet(tokens);
  await clearPropertyTuning();
});

test('a slider field bound to a px property sets it, and separate arrow key presses are one undo step', async () => {
  const session = await renderSession();
  const screen = await renderFields();
  const slider = screen.getByRole('slider', { name: 'Size' });
  await expect.element(slider).toHaveValue('18');

  await focusAndPress(slider.element(), '{ArrowRight}{ArrowRight}');
  const whileEdited = pageValue('--size');
  await session.act(() => session.result.current.undo());

  expect([whileEdited, pageValue('--size'), session.result.current.undoIds]).toEqual(['20px', '18px', null]);
});

test('holding an arrow key on a bound slider field is one undo step', async () => {
  const session = await renderSession();
  const screen = await renderFields();
  const slider = screen.getByRole('slider', { name: 'Size' });
  await expect.element(slider).toHaveValue('18');

  await focusAndPress(slider.element(), '{ArrowRight>3}{/ArrowRight}');
  const whileEdited = pageValue('--size');
  await session.act(() => session.result.current.undo());

  expect([whileEdited, pageValue('--size'), session.result.current.undoIds]).toEqual(['21px', '18px', null]);
});

test('each value typed into a slider field is its own undo step', async () => {
  const session = await renderSession();
  const screen = await renderFields();
  const input = screen.getByRole('textbox', { name: 'Size' });
  await expect.element(input).toHaveValue('18');

  await userEvent.fill(input, '24');
  await userEvent.keyboard('{Enter}');
  await userEvent.fill(input, '30');
  await userEvent.keyboard('{Enter}');
  await session.act(() => session.result.current.undo());

  expect(pageValue('--size')).toBe('24px');
});

test('double-clicking the slider thumb resets the value to its default', async () => {
  const size = await renderProperty('--size');
  await renderSession();
  const screen = await renderFields();
  await size.act(() => size.result.current.onValueChange('40px'));
  const thumb = screen.getByRole('slider', { name: 'Size' }).element().closest('.fp-SliderThumb');
  if (!(thumb instanceof HTMLElement)) throw new Error('The slider has no thumb');

  await userEvent.dblClick(thumb);

  expect([pageValue('--size'), size.result.current.changed]).toEqual(['18px', false]);
});

test('the reset button shows only while its value is changed, and resets it', async () => {
  const size = await renderProperty('--size');
  await renderSession();
  const screen = await renderFields();
  const reset = screen.getByLabelText('Reset');
  await expect.element(reset).not.toBeVisible();
  await size.act(() => size.result.current.onValueChange('40px'));
  await expect.element(reset).toBeVisible();

  await reset.click();

  await expect.element(reset).not.toBeVisible();
  expect(pageValue('--size')).toBe('18px');
});

test('a number field scaled to percent shows an em value as a percentage and writes em', async () => {
  const tracking = await renderProperty('--tracking');
  await renderSession();
  const screen = await renderFields();
  const input = screen.getByRole('textbox', { name: 'Tracking' });
  await expect.element(input).toHaveValue('0.8%');

  await userEvent.fill(input, '1.5');
  await userEvent.keyboard('{Enter}');

  expect(tracking.result.current.value).toBe('0.015em');
});

test('a color field writes a typed hex and an opacity in the format of the value', async () => {
  const ink = await renderProperty('--ink');
  await renderSession();
  const screen = await renderFields();
  const hex = screen.getByRole('textbox', { name: 'Ink' });
  await expect.element(hex).toHaveValue('3C3C3C');

  await userEvent.fill(hex, 'ff0000');
  await userEvent.keyboard('{Enter}');
  const afterHex = ink.result.current.value;
  await userEvent.fill(screen.getByRole('textbox', { name: 'Opacity' }).first(), '50');
  await userEvent.keyboard('{Enter}');

  expect([afterHex, ink.result.current.value]).toEqual(['#ff0000', '#ff000080']);
});

test('a color field bound to a reference shows the color it resolves to, and an edit detaches it', async () => {
  const link = await renderProperty('--link');
  await renderSession();
  const screen = await renderFields();
  const hex = screen.getByRole('textbox', { name: 'Link' });
  await expect.element(hex).toHaveValue('0D99FF');

  await userEvent.fill(hex, '000000');
  await userEvent.keyboard('{Enter}');

  expect([link.result.current.entry?.form, link.result.current.value]).toEqual(['raw', '#000000']);
});

test('each choice in a segmented field is its own undo step', async () => {
  const session = await renderSession();
  const align = await renderProperty('--align');
  const screen = await renderFields();
  await expect.element(screen.getByRole('button', { name: 'Right' })).toBeVisible();

  await screen.getByRole('button', { name: 'Right' }).click();
  await screen.getByRole('button', { name: 'Left' }).click();
  await screen.getByRole('button', { name: 'Right' }).click();
  await session.act(() => session.result.current.undo());

  expect(align.result.current.value).toBe('left');
});

async function renderFields() {
  const screen = await render(
    <InPanel>
      <BoundFields />
    </InPanel>
  );
  await openPanel();
  return screen;
}

function BoundFields() {
  const size = useProperty('--size', { codec: PX });
  const tracking = useProperty('--tracking', { codec: EM });
  const ink = useProperty('--ink', { codec: CSS_COLOR });
  const link = useProperty('--link', { codec: CSS_COLOR });
  const align = useProperty('--align');
  return (
    <>
      <Row.Root>
        <Row.Field span={2}>
          <Row.Label>Size</Row.Label>
          <SliderField {...size} min={8} max={64} />
        </Row.Field>
        <Row.Rail>
          <ResetButton {...size} />
        </Row.Rail>
      </Row.Root>
      <Row.Root>
        <Row.Field>
          <Row.Label>Tracking</Row.Label>
          <NumberField {...tracking} step={0.001} scale={100} suffix="%" />
        </Row.Field>
        <Row.Field>
          <Row.Label>Align</Row.Label>
          <SegmentedField {...align} options={ALIGNMENTS} />
        </Row.Field>
      </Row.Root>
      <Row.Root>
        <Row.Field span={2}>
          <Row.Label>Ink</Row.Label>
          <ColorField {...ink} />
        </Row.Field>
      </Row.Root>
      <Row.Root>
        <Row.Field span={2}>
          <Row.Label>Link</Row.Label>
          <ColorField {...link} />
        </Row.Field>
      </Row.Root>
    </>
  );
}
