'use client';

import { Panel } from '@/lib/tuner/ui';

export function TunerPanel() {
  return (
    <Panel.Root>
      <Panel.Trigger />
      <Panel.Drawer>
        <Panel.Header>
          <Panel.Title>Tuner</Panel.Title>
          <Panel.Undo />
          <Panel.Redo />
          <Panel.Close />
        </Panel.Header>
        <Panel.Body />
        <Panel.Footer>
          <Panel.Reset />
          <Panel.Save />
        </Panel.Footer>
      </Panel.Drawer>
    </Panel.Root>
  );
}
