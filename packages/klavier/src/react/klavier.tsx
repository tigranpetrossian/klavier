import { useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { ComponentProps, CSSProperties, ReactElement, Ref } from 'react';
import { createKlavier } from '../create-klavier';
import { naturalAspectRatio } from '../layout-keys';
import type { KlavierInstance, KlavierOptions, NoteOffEvent, NoteOnEvent } from '../klavier-types';
import type { KlavierLayout } from '../layout-keys';

const UNMOUNTED_LAYOUT: KlavierLayout = { width: 0, height: 0, pixelRatio: 1, range: [0, 0], keys: [] };

type KlavierHandle = Pick<KlavierInstance, 'layout' | 'focus' | 'redraw'>;

interface KlavierProps extends KlavierOptions, Omit<ComponentProps<'div'>, 'children' | 'ref'> {
  onNoteOn?: ((event: NoteOnEvent) => void) | undefined;
  onNoteOff?: ((event: NoteOffEvent) => void) | undefined;
  onLayout?: ((layout: KlavierLayout) => void) | undefined;
  ref?: Ref<KlavierHandle> | undefined;
}

function Klavier({
  range,
  pressed,
  highlights,
  interactive,
  computerKeyboard,
  keymap,
  keymapBase,
  touchAction,
  blackKeyLength,
  painter,
  overlay,
  keyName,
  onNoteOn,
  onNoteOff,
  onLayout,
  ref,
  ...rootProps
}: KlavierProps): ReactElement {
  const options: KlavierOptions = {
    range,
    pressed,
    highlights,
    interactive,
    computerKeyboard,
    keymap,
    keymapBase,
    touchAction,
    blackKeyLength,
    painter,
    overlay,
    keyName,
  };
  const mountRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<KlavierInstance | null>(null);
  const latestRef = useRef({ options, onNoteOn, onNoteOff, onLayout });

  useLayoutEffect(() => {
    latestRef.current = { options, onNoteOn, onNoteOff, onLayout };
  });

  useLayoutEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const instance = createKlavier(mount, latestRef.current.options);
    instance.on('noteon', (event) => latestRef.current.onNoteOn?.(event));
    instance.on('noteoff', (event) => latestRef.current.onNoteOff?.(event));
    instance.on('layout', (layout) => latestRef.current.onLayout?.(layout));
    instanceRef.current = instance;
    latestRef.current.onLayout?.(instance.layout);

    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    instanceRef.current?.update(options);
  });

  useImperativeHandle(
    ref,
    () => ({
      get layout() {
        return instanceRef.current?.layout ?? UNMOUNTED_LAYOUT;
      },
      focus: () => instanceRef.current?.focus(),
      redraw: () => instanceRef.current?.redraw(),
    }),
    []
  );

  return (
    <div {...rootProps}>
      <div ref={mountRef} style={reservedSpace(range)} />
    </div>
  );
}

// The core's surface is sized the same way; this holds its place in server-rendered markup.
function reservedSpace(range: KlavierOptions['range']): CSSProperties {
  return { width: 0, minWidth: '100%', height: '100%', aspectRatio: naturalAspectRatio(range) };
}

export { Klavier };
export type { KlavierHandle, KlavierProps };
