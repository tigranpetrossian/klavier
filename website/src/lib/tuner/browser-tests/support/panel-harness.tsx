import type { ReactNode } from 'react';
import { page, userEvent } from 'vitest/browser';
import { Panel } from '@/lib/tuner/ui';

const PANEL_OPEN_MS = 50;

export function InPanel({ children }: { children: ReactNode }) {
  return (
    <Panel.Root>
      <Panel.Trigger />
      <Panel.Drawer>
        <Panel.Body>{children}</Panel.Body>
      </Panel.Drawer>
    </Panel.Root>
  );
}

export async function openPanel(): Promise<void> {
  await page.getByRole('button', { name: 'Open tuner' }).click();
  await new Promise((resolve) => setTimeout(resolve, PANEL_OPEN_MS));
}

export async function focusAndPress(element: HTMLElement | SVGElement, keys: string): Promise<void> {
  element.focus();
  await userEvent.keyboard(keys);
}

export function pageValue(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
