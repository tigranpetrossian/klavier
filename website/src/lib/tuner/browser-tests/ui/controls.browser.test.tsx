import { useState } from 'react';
import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { focusAndPress, InPanel, openPanel } from '../support/panel-harness';
import { NumberField, NumericSelectField, Row, SelectField, SliderField, SwitchField, TextField } from '@/lib/tuner/ui';

const SIZES = [12, 16, 24];
const CASES = [
  { value: 'none', label: 'As typed' },
  { value: 'upper', label: 'Uppercase' },
];

test('dragging a slider field changes it to where the drag ends', async () => {
  const log: string[] = [];
  const screen = await renderInPanel(<LoggedSlider log={log} />);
  const thumb = screen.getByRole('slider', { name: 'Size' }).element().closest('.fp-SliderThumb');
  const track = screen.getByRole('slider', { name: 'Size' }).element().closest('.fp-SliderControl');
  if (!(thumb instanceof HTMLElement) || !(track instanceof HTMLElement)) throw new Error('The slider has no thumb');

  await userEvent.dragAndDrop(thumb, track, { targetPosition: { x: track.offsetWidth - 2, y: 2 } });

  expect(log.at(-1)).toMatch(/^change 9\d$/);
});

test('holding an arrow key in a number field changes it once per repeat', async () => {
  const log: string[] = [];
  const screen = await renderInPanel(<LoggedNumber log={log} />);

  await focusAndPress(screen.getByRole('textbox', { name: 'Gap' }).element(), '{ArrowUp>3}{/ArrowUp}');

  expect(log).toEqual(['change 13', 'change 14', 'change 15']);
});

test('a value typed into a number field changes it once', async () => {
  const log: string[] = [];
  const screen = await renderInPanel(<LoggedNumber log={log} />);

  await userEvent.fill(screen.getByRole('textbox', { name: 'Gap' }), '20');
  await userEvent.keyboard('{Enter}');

  expect(log).toEqual(['change 20']);
});

test('a numeric select previews the highlighted option, ends the preview on close, and changes to a choice', async () => {
  const log: string[] = [];
  const screen = await renderInPanel(<LoggedNumericSelect log={log} />);
  await screen.getByLabelText('Select value').click();
  await screen.getByRole('option', { name: '24' }).hover();
  await expect.poll(() => log.at(-1)).toBe('preview 24');

  await screen.getByRole('option', { name: '24' }).click();

  expect(log.slice(log.indexOf('preview 24'))).toEqual(['preview 24', 'preview null', 'change 24']);
});

test('a select field changes to each choice', async () => {
  const log: string[] = [];
  const screen = await renderInPanel(<LoggedSelect log={log} />);
  await screen.getByRole('combobox', { name: 'Case' }).click();

  await screen.getByRole('option', { name: 'Uppercase' }).click();

  expect(log).toEqual(['change upper']);
  await expect.element(screen.getByRole('combobox', { name: 'Case' })).toHaveTextContent('Uppercase');
});

test('a switch field changes on each toggle', async () => {
  const log: string[] = [];
  const screen = await renderInPanel(<LoggedSwitch log={log} />);

  await screen.getByRole('switch', { name: 'Hyphenate' }).click();

  expect(log).toEqual(['change true']);
});

test('a text field changes on Enter, and Escape drops the edit', async () => {
  const log: string[] = [];
  const screen = await renderInPanel(<LoggedText log={log} />);
  const input = screen.getByRole('textbox', { name: 'Family' });

  await userEvent.fill(input, 'Inter, serif');
  await userEvent.keyboard('{Escape}');
  await expect.element(input).toHaveValue('Inter');
  await userEvent.fill(input, 'Roobert');
  await userEvent.keyboard('{Enter}');

  expect(log).toEqual(['change Roobert']);
  await expect.element(input).toHaveValue('Roobert');
});

async function renderInPanel(children: React.ReactNode) {
  const screen = await render(<InPanel>{children}</InPanel>);
  await openPanel();
  return screen;
}

function logged<T>(log: string[], setValue: (value: T) => void) {
  return {
    onValueChange: (value: T) => {
      log.push(`change ${String(value)}`);
      setValue(value);
    },
  };
}

function LoggedSlider({ log }: { log: string[] }) {
  const [value, setValue] = useState(10);
  return (
    <Row.Root>
      <Row.Field span={2}>
        <Row.Label>Size</Row.Label>
        <SliderField value={value} {...logged(log, setValue)} min={0} max={100} />
      </Row.Field>
    </Row.Root>
  );
}

function LoggedNumber({ log }: { log: string[] }) {
  const [value, setValue] = useState(12);
  return (
    <Row.Root>
      <Row.Field>
        <Row.Label>Gap</Row.Label>
        <NumberField value={value} {...logged(log, setValue)} />
      </Row.Field>
    </Row.Root>
  );
}

function LoggedNumericSelect({ log }: { log: string[] }) {
  const [value, setValue] = useState(16);
  return (
    <Row.Root>
      <Row.Field>
        <Row.Label>Size</Row.Label>
        <NumericSelectField
          value={value}
          {...logged(log, setValue)}
          onPreviewChange={(preview) => log.push(`preview ${String(preview)}`)}
          options={SIZES}
        />
      </Row.Field>
    </Row.Root>
  );
}

function LoggedSelect({ log }: { log: string[] }) {
  const [value, setValue] = useState('none');
  return (
    <Row.Root>
      <Row.Field>
        <Row.Label>Case</Row.Label>
        <SelectField value={value} {...logged(log, setValue)} options={CASES} />
      </Row.Field>
    </Row.Root>
  );
}

function LoggedSwitch({ log }: { log: string[] }) {
  const [value, setValue] = useState(false);
  return <SwitchField label="Hyphenate" value={value} {...logged(log, setValue)} />;
}

function LoggedText({ log }: { log: string[] }) {
  const [value, setValue] = useState('Inter');
  return (
    <Row.Root>
      <Row.Field span={2}>
        <Row.Label>Family</Row.Label>
        <TextField value={value} {...logged(log, setValue)} />
      </Row.Field>
    </Row.Root>
  );
}
