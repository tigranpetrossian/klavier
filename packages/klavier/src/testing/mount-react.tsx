import { createRef } from 'react';
import { render } from 'vitest-browser-react';
import type { ReactElement } from 'react';
import { Klavier } from '../react/klavier';
import type { KlavierOptions } from '../klavier-types';
import type { KlavierLayout } from '../layout-keys';
import type { KlavierHandle } from '../react/klavier';
import { HOST_STYLE, createRecording, nextFrame, trackMounted, withTestDefaults } from './mounted';
import type { Mount } from './mounted';

const UNMOUNTED_LAYOUT: KlavierLayout = { width: 0, height: 0, pixelRatio: 1, range: [0, 0], keys: [] };

const mountReact: Mount = async (options, settings) => {
  const recording = createRecording();
  const handle = createRef<KlavierHandle>();
  const container = settings?.container ?? document.body.appendChild(document.createElement('div'));
  let props = withTestDefaults(options, recording);

  const element = (current: KlavierOptions): ReactElement => (
    <Klavier
      {...current}
      ref={handle}
      style={settings?.style ?? HOST_STYLE}
      onNoteOn={recording.onNoteOn}
      onNoteOff={recording.onNoteOff}
      onLayout={recording.onLayout}
    />
  );

  const screen = await render(element(props), { container });
  const host = container.firstElementChild;
  if (!(host instanceof HTMLElement)) throw new Error('<Klavier> rendered no root element');
  await nextFrame();

  return trackMounted(
    {
      host,
      log: recording.log,
      layouts: recording.layouts,
      frames: recording.frames,
      layout: () => handle.current?.layout ?? UNMOUNTED_LAYOUT,
      update: async (patch) => {
        props = { ...props, ...patch };
        await screen.rerender(element(props));
      },
      focus: () => {
        handle.current?.focus();
      },
    },
    async () => {
      await screen.unmount();
    }
  );
};

export { mountReact };
