import { createKlavier } from '../create-klavier';
import { HOST_STYLE, createRecording, nextFrame, trackMounted, withTestDefaults } from './mounted';
import type { Mount } from './mounted';

const mountCore: Mount = async (options, settings) => {
  const recording = createRecording();
  const host = document.createElement('div');
  Object.assign(host.style, settings?.style ?? HOST_STYLE);
  (settings?.container ?? document.body).append(host);

  const instance = createKlavier(host, withTestDefaults(options, recording));
  instance.on('noteon', recording.onNoteOn);
  instance.on('noteoff', recording.onNoteOff);
  instance.on('layout', recording.onLayout);
  await nextFrame();

  return trackMounted(
    {
      host,
      log: recording.log,
      layouts: recording.layouts,
      frames: recording.frames,
      layout: () => instance.layout,
      update: async (patch) => {
        instance.update(patch);
      },
      focus: () => {
        instance.focus();
      },
    },
    async () => {
      instance.destroy();
      host.remove();
    }
  );
};

export { mountCore };
