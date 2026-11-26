import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { Panel } from '@/lib/tuner/ui';

afterEach(() => {
  vi.restoreAllMocks();
});

test('the trigger opens the panel, hiding itself, and the close button closes it', async () => {
  const screen = await render(<SamplePanel />);
  await screen.getByRole('button', { name: 'Open tuner' }).click();
  await expect.element(screen.getByText('Panel content')).toBeVisible();
  await expect.element(screen.getByLabelText('Open tuner')).not.toBeVisible();

  await screen.getByRole('button', { name: 'Close tuner' }).click();

  await expect.element(screen.getByText('Panel content')).not.toBeInTheDocument();
  await expect.element(screen.getByLabelText('Open tuner')).toBeVisible();
});

test('a panel left open opens again on the next page load', async () => {
  const firstLoad = await render(<SamplePanel />);
  await firstLoad.getByRole('button', { name: 'Open tuner' }).click();
  await expect.element(firstLoad.getByText('Panel content')).toBeVisible();
  await firstLoad.unmount();

  const nextLoad = await render(<SamplePanel />);

  await expect.element(nextLoad.getByText('Panel content')).toBeVisible();
});

test('a panel closed again stays closed on the next page load', async () => {
  const firstLoad = await render(<SamplePanel />);
  await firstLoad.getByRole('button', { name: 'Open tuner' }).click();
  await firstLoad.getByRole('button', { name: 'Close tuner' }).click();
  await expect.element(firstLoad.getByText('Panel content')).not.toBeInTheDocument();
  await firstLoad.unmount();

  const nextLoad = await render(<SamplePanel />);

  await expect.element(nextLoad.getByLabelText('Open tuner')).toBeVisible();
  await expect.element(nextLoad.getByText('Panel content')).not.toBeInTheDocument();
});

test('the panel opens and closes when session storage is unavailable', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('Storage is disabled', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Storage is disabled', 'SecurityError');
  });
  const screen = await render(<SamplePanel />);
  await screen.getByRole('button', { name: 'Open tuner' }).click();
  await expect.element(screen.getByText('Panel content')).toBeVisible();

  await screen.getByRole('button', { name: 'Close tuner' }).click();

  await expect.element(screen.getByText('Panel content')).not.toBeInTheDocument();
});

function SamplePanel() {
  return (
    <Panel.Root>
      <Panel.Trigger />
      <Panel.Drawer>
        <Panel.Header>
          <Panel.Title>Tuner</Panel.Title>
          <Panel.Close />
        </Panel.Header>
        <Panel.Body>Panel content</Panel.Body>
      </Panel.Drawer>
    </Panel.Root>
  );
}
