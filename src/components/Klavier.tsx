import React, { useMemo, useRef } from 'react';
import type { Keymap, CustomKeyComponent } from 'types';
import { DEFAULT_KEYMAP } from 'keymap';
import { Key } from 'components/Key';
import { defaultKeyComponents } from 'components/Key/defaultKeyComponents';
import { range } from 'utils/range';
import { isMidiNumber } from 'utils/midi';
import { useKlavier } from 'state/useKlavier';
import { useMouse } from 'interactivity/useMouse';
import { useKeyboard } from 'interactivity/useKeyboard';
import { useTouch } from 'interactivity/useTouch';

interface KlavierProps {
  /**
   * The lowest and the highest notes of the piano in MIDI numbers (0-127).
   * @defaultValue [21, 108]
   */
  noteRange?: [number, number];

  /**
   * Notes that are pressed by default. Subsequent updates are ignored. Cleared when the user begins playing.
   */
  defaultActiveNotes?: Array<number>;

  /**
   * Currently pressed notes. Puts component into controlled mode; active notes must be managed externally via callbacks.
   */
  activeNotes?: Array<number>;

  /**
   * Fired when a note is played.
   */
  onNotePlay?: (midiNumber: number) => void;

  /**
   * Fired when a note is stopped.
   */
  onNoteStop?: (midiNumber: number) => void;

  /**
   * Fired when active notes are changed via user input.
   */
  onChange?: (activeNotes: Array<number>) => void;

  /**
   * Enable interaction with the piano via keyboard, mouse, or touch.
   * @defaultValue true
   */
  interactive?: boolean | Partial<InteractivitySettings>;

  /*
   * Mapping of computer keys to MIDI note numbers.
   * @example [{ key: 'q', midiNumber: 60 }, ..., { key: 'i', midiNumber: 72 }]
   */
  keyMap?: Keymap;

  /**
   * Width of the piano. Accepts any valid CSS value. When unspecified, the piano fills it's container and is responsive.
   * @defaultValue 'auto'
   *
   */
  width?: React.CSSProperties['width'];

  /**
   * Height of the piano. Accepts any valid CSS value.
   * @defaultValue 'auto'
   */
  height?: React.CSSProperties['height'];

  /**
   * Aspect ratio of the white key in CSS format. Ignored when `height` is specified.
   * @defaultValue '23 / 150'
   */
  whiteKeyAspectRatio?: React.CSSProperties['aspectRatio'];

  /**
   * Height of the black key. Allows tweaking the appearance of black keys in relation to white keys.
   * @defaultValue '67.5%'
   */
  blackKeyHeight?: React.CSSProperties['height'];

  /**
   * Allows replacing default components for black and white keys. Provided with `innerProps` which needs to be spread onto
   * custom components root.
   * Important: avoid defining components directly in the prop object, as it can cause performance issues.
   * @example:
   * const CustomBlackKey = ({ innerProps, active, note }) => { return <div {...innerProps} /> }
   * const CustomWhiteKey = ({ innerProps, active, note }) => { return <div {...innerProps} /> }
   * <Klavier components={{ blackKey: CustomBlackKey, whiteKey: CustomWhiteKey }} />
   */
  components?: {
    blackKey: CustomKeyComponent;
    whiteKey: CustomKeyComponent;
  };
}

const Klavier = (props: KlavierProps) => {
  const klavierRootRef = useRef<HTMLDivElement>(null);
  const {
    defaultActiveNotes,
    activeNotes,
    onNotePlay,
    onNoteStop,
    onChange,
    noteRange = [21, 108],
    interactive = true,
    keyMap = DEFAULT_KEYMAP,
    width,
    height,
    whiteKeyAspectRatio,
    blackKeyHeight,
    components = defaultKeyComponents,
  } = props;
  const [first, last] = noteRange;
  const {
    state,
    actions: { playNote, stopNote },
  } = useKlavier({
    defaultActiveNotes,
    activeNotes,
    onNotePlay,
    onNoteStop,
    onChange,
  });
  const rootStyles = useMemo(() => getRootStyles(width, height), [width, height]);
  const interactivitySettings = determineInteractivitySettings(interactive);
  validateRange(noteRange);

  const handleMouseEvents = useMouse({ enabled: interactivitySettings.mouse, playNote, stopNote });
  useKeyboard({
    enabled: interactivitySettings.keyboard,
    activeNotes: state.activeNotes,
    keyMap,
    noteRange,
    playNote,
    stopNote,
  });
  useTouch({ enabled: interactivitySettings.touch, klavierRootRef, playNote, stopNote });

  return (
    <div style={rootStyles} ref={klavierRootRef}>
      {range(first, last + 1).map((midiNumber) => (
        <Key
          key={midiNumber}
          midiNumber={midiNumber}
          firstNoteMidiNumber={first}
          active={state.activeNotes.includes(midiNumber)}
          onMouseDown={handleMouseEvents}
          onMouseUp={handleMouseEvents}
          onMouseLeave={handleMouseEvents}
          onMouseEnter={handleMouseEvents}
          isFixedHeight={height !== undefined}
          whiteKeyAspectRatio={whiteKeyAspectRatio}
          blackKeyHeight={blackKeyHeight}
          components={components}
        />
      ))}
    </div>
  );
};

const getRootStyles = (
  width: React.CSSProperties['width'],
  height: React.CSSProperties['height']
): React.CSSProperties => ({
  display: 'grid',
  alignItems: 'stretch',
  gridAutoColumns: '1fr',
  gap: '1px',
  position: 'relative',
  WebkitUserSelect: 'none',
  userSelect: 'none',
  width,
  height,
});

type InteractivitySettings = {
  keyboard: boolean;
  mouse: boolean;
  touch: boolean;
};

function determineInteractivitySettings(prop: KlavierProps['interactive']): InteractivitySettings {
  if (typeof prop === 'boolean') {
    return {
      mouse: prop,
      keyboard: prop,
      touch: prop,
    };
  }

  return {
    mouse: false,
    keyboard: false,
    touch: false,
    ...prop,
  };
}

const ERRORS = {
  INVALID_MIDI_VALUES: 'Note range must be within valid MIDI numbers (0-127).',
  INVALID_RANGE_ORDER: 'The last note must be greater than the first.',
};

function validateRange([first, last]: [number, number]) {
  const receivedRangeDisplay = `Received range: [${first}, ${last}]`;

  if (!isMidiNumber(first) || !isMidiNumber(last)) {
    throw new Error(`${ERRORS.INVALID_MIDI_VALUES} ${receivedRangeDisplay}`);
  }

  if (first >= last) {
    throw new Error(`${ERRORS.INVALID_RANGE_ORDER} ${receivedRangeDisplay}`);
  }
}

export type { KlavierProps };
export { Klavier };
