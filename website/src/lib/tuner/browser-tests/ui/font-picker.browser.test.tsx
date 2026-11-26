import { beforeEach, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import { InPanel, pageValue, openPanel } from '../support/panel-harness';
import { clearPropertyTuning, renderProperty, serveStylesheet } from '../support/property-harness';
import fonts from './font-picker/fonts.css?raw';
import { FONT_FAMILY, FontPicker, Row, type FontOption } from '@/lib/tuner/ui';
import { useProperty } from '@/lib/tuner/react';

const FONTS: readonly FontOption[] = [
  { family: 'Inter', label: 'Inter', axes: [], features: [] },
  { family: 'Roobert VF-TRIAL', label: 'Roobert', axes: [], features: [] },
  { family: 'Tobias VF-TRIAL', label: 'Tobias', axes: [], features: [] },
];
const MANY_FONTS: readonly FontOption[] = Array.from({ length: 40 }, (_, index) => ({
  family: `Family ${index}`,
  label: `Family ${index}`,
  axes: [],
  features: [],
}));

beforeEach(async () => {
  serveStylesheet(fonts);
  await clearPropertyTuning();
});

test('highlighting a font shows it on the page without editing the value', async () => {
  const session = await renderSession();
  const font = await renderProperty('--font');
  const screen = await renderPicker();
  await screen.getByRole('combobox', { name: 'Font' }).click();

  await screen.getByRole('option', { name: 'Roobert' }).hover();

  await expect.poll(() => pageValue('--font')).toBe("'Roobert VF-TRIAL', sans-serif");
  expect([font.result.current.value, font.result.current.changed, session.result.current.undoIds]).toEqual([
    "'Inter', sans-serif",
    false,
    null,
  ]);
});

test('closing the list without choosing shows the original font again', async () => {
  await renderSession();
  const screen = await renderPicker();
  await screen.getByRole('combobox', { name: 'Font' }).click();
  await screen.getByRole('option', { name: 'Tobias' }).hover();
  await expect.poll(() => pageValue('--font')).toBe("'Tobias VF-TRIAL', sans-serif");

  await userEvent.keyboard('{Escape}');

  await expect.poll(() => pageValue('--font')).toBe("'Inter', sans-serif");
});

test('choosing a font sets the value as one undo step and keeps the fallbacks', async () => {
  const session = await renderSession();
  const font = await renderProperty('--font');
  const screen = await renderPicker();
  await screen.getByRole('combobox', { name: 'Font' }).click();

  await screen.getByRole('option', { name: 'Tobias' }).click();
  const chosen = [font.result.current.value, pageValue('--font')];
  await session.act(() => session.result.current.undo());

  expect([...chosen, pageValue('--font')]).toEqual([
    "'Tobias VF-TRIAL', sans-serif",
    "'Tobias VF-TRIAL', sans-serif",
    "'Inter', sans-serif",
  ]);
  await expect.element(screen.getByRole('combobox', { name: 'Font' })).toHaveTextContent('Inter');
});

test('typing filters the list by label', async () => {
  await renderSession();
  const screen = await renderPicker();
  await screen.getByRole('combobox', { name: 'Font' }).click();

  await userEvent.fill(screen.getByPlaceholder('Search fonts'), 'tob');

  await expect.element(screen.getByRole('option', { name: 'Tobias' })).toBeVisible();
  await expect.element(screen.getByRole('option', { name: 'Roobert' })).not.toBeInTheDocument();
});

test('a family that is not in the list still shows as the value', async () => {
  const font = await renderProperty('--font');
  await renderSession();
  const screen = await renderPicker();
  await font.act(() => font.result.current.onValueChange("'Comic Sans MS', sans-serif"));

  await expect.element(screen.getByRole('combobox', { name: 'Font' })).toHaveTextContent('Comic Sans MS');
});

test('opening a long list scrolls to the chosen font', async () => {
  const font = await renderProperty('--font');
  await renderSession();
  const screen = await renderPicker(MANY_FONTS);
  await font.act(() => font.result.current.onValueChange("'Family 36', sans-serif"));

  await screen.getByRole('combobox', { name: 'Font' }).click();

  await expect.element(screen.getByRole('option', { name: 'Family 36' })).toBeInViewport();
});

async function renderPicker(fonts = FONTS) {
  const screen = await render(
    <InPanel>
      <BoundPicker fonts={fonts} />
    </InPanel>
  );
  await openPanel();
  return screen;
}

function BoundPicker({ fonts }: { fonts: readonly FontOption[] }) {
  const font = useProperty('--font', { codec: FONT_FAMILY });
  return (
    <Row.Root>
      <Row.Field span={2}>
        <Row.Label>Font</Row.Label>
        <FontPicker {...font} fonts={fonts} />
      </Row.Field>
    </Row.Root>
  );
}
