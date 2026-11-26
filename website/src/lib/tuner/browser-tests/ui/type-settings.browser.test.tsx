import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { renderSession } from '../support/harness';
import { focusAndPress, InPanel, pageValue, openPanel } from '../support/panel-harness';
import { clearPropertyTuning, serveStylesheet } from '../support/property-harness';
import tokens from './type-settings/tokens.css?raw';
import {
  cssNumber,
  FEATURE_SETTINGS,
  Row,
  Section,
  TypeSettings,
  type FontOption,
  type FontSettingsControl,
  VARIATION_SETTINGS,
} from '@/lib/tuner/ui';
import { useProperty } from '@/lib/tuner/react';

const NUMBER = cssNumber();
const ROOBERT: FontOption = {
  family: 'Roobert VF-TRIAL',
  label: 'Roobert',
  axes: [
    { tag: 'wght', name: 'Weight', min: 300, max: 900, defaultValue: 300 },
    { tag: 'slnt', name: 'Slant', min: -11, max: 0, defaultValue: 0 },
    { tag: 'MONO', name: 'Mono', min: 0, max: 100, defaultValue: 0 },
  ],
  features: [
    { tag: 'liga', name: 'Standard ligatures' },
    { tag: 'ss01', name: '[ss01] a' },
    { tag: 'tnum', name: 'Tabular figures' },
  ],
};
const STATIC_FONT: FontOption = { family: 'Static', label: 'Static', axes: [], features: [] };

beforeEach(async () => {
  serveStylesheet(tokens);
  await clearPropertyTuning();
});

test('the type settings open against the outer edge of the panel, level with their trigger', async () => {
  await page.viewport(1200, 800);
  await renderSession();
  const screen = await renderTypeSettings(ROOBERT);
  const trigger = screen.getByRole('button', { name: 'Type settings' });

  await trigger.click();

  const popup = screen.getByRole('dialog', { name: 'Type settings' });
  await expect.element(popup).toBeVisible();
  const panel = trigger.element().closest('.tuner-Panel');
  const popupBox = popup.element().getBoundingClientRect();
  expect([popupBox.right, popupBox.top]).toEqual([
    panel?.getBoundingClientRect().left,
    trigger.element().getBoundingClientRect().top,
  ]);
});

test('each axis edits the variation settings, and an axis can be routed to another value', async () => {
  await renderSession();
  const screen = await renderTypeSettings(ROOBERT);
  await screen.getByRole('button', { name: 'Type settings' }).click();
  const weight = screen.getByRole('slider', { name: 'Weight' });
  await expect.element(weight).toHaveValue('480');

  await focusAndPress(screen.getByRole('slider', { name: 'Slant' }).element(), '{ArrowLeft}');
  await focusAndPress(weight.element(), '{ArrowRight}');

  expect([pageValue('--font-axes'), pageValue('--font-weight')]).toEqual(["'MONO' 0, 'slnt' -1", '481']);
});

test('a feature that is on by default shows on, turning it off writes 0, and turning it back on drops it', async () => {
  await renderSession();
  const screen = await renderTypeSettings(ROOBERT);
  await openFeatures(screen);
  const ligatures = screen.getByRole('switch', { name: /Standard ligatures/ });
  await expect.element(ligatures).toBeChecked();

  await ligatures.click();
  const turnedOff = pageValue('--font-features');
  await ligatures.click();

  expect([turnedOff, pageValue('--font-features')]).toEqual(["'ss01' 1, 'liga' 0", "'ss01' 1"]);
});

test('a feature that is off by default shows on only when listed, and turning every one off writes normal', async () => {
  await renderSession();
  const screen = await renderTypeSettings(ROOBERT);
  await openFeatures(screen);
  const tabular = screen.getByRole('switch', { name: /Tabular figures/ });
  await expect.element(tabular).not.toBeChecked();
  await expect.element(screen.getByRole('switch', { name: /\[ss01\] a/ })).toBeChecked();

  await tabular.click();
  const turnedOn = pageValue('--font-features');
  await tabular.click();
  await screen.getByRole('switch', { name: /\[ss01\] a/ }).click();

  expect([turnedOn, pageValue('--font-features')]).toEqual(["'ss01' 1, 'tnum' 1", 'normal']);
});

test('a font without axes or features says so', async () => {
  await renderSession();
  const screen = await renderTypeSettings(STATIC_FONT);
  await screen.getByRole('button', { name: 'Type settings' }).click();
  await expect.element(screen.getByText('This font has no variable axes.')).toBeVisible();

  await screen.getByRole('tab', { name: 'Features' }).click();

  await expect.element(screen.getByText('This font has no OpenType features.')).toBeVisible();
});

async function openFeatures(screen: Awaited<ReturnType<typeof renderTypeSettings>>): Promise<void> {
  await screen.getByRole('button', { name: 'Type settings' }).click();
  await screen.getByRole('tab', { name: 'Features' }).click();
}

async function renderTypeSettings(font: FontOption) {
  const screen = await render(
    <InPanel>
      <BoundTypeSettings font={font} />
    </InPanel>
  );
  await openPanel();
  return screen;
}

function BoundTypeSettings({ font }: { font: FontOption }) {
  const weight = useProperty('--font-weight', { codec: NUMBER });
  const variation = useProperty('--font-axes', { codec: VARIATION_SETTINGS });
  const features = useProperty('--font-features', { codec: FEATURE_SETTINGS });
  const axes: FontSettingsControl = {
    value: { ...variation.value, wght: weight.value },
    onValueChange: ({ wght = weight.value, ...rest }) => {
      if (wght === weight.value) variation.onValueChange(rest);
      else weight.onValueChange(wght);
    },
    disabled: variation.disabled,
  };
  return (
    <Section.Root>
      <Section.Header>
        <Section.Title>Type</Section.Title>
      </Section.Header>
      <Section.Body>
        <Row.Root>
          <Row.Rail>
            <TypeSettings font={font} axes={axes} features={features} />
          </Row.Rail>
        </Row.Root>
      </Section.Body>
    </Section.Root>
  );
}
