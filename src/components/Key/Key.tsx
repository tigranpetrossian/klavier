import React, { useMemo } from 'react';
import { midiToNote } from 'lib/midi';
import type { CustomKeyComponent, KeyColor } from 'types';
import { DEFAULT_BLACK_KEY_HEIGHT, DEFAULT_WHITE_KEY_ASPECT_RATIO } from 'lib/constants';
import { defaultKeyComponents } from 'components/Key/defaultKeyComponents';

type KeyProps = {
  midiNumber: number;
  firstNoteMidiNumber: number;
  components?: {
    blackKey?: CustomKeyComponent;
    whiteKey?: CustomKeyComponent;
  };
  whiteKeyAspectRatio?: React.CSSProperties['aspectRatio'];
  blackKeyHeight?: React.CSSProperties['height'];
  isFixedHeight: boolean;
  active: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

const Key = React.memo((props: KeyProps) => {
  const {
    active,
    midiNumber,
    firstNoteMidiNumber,
    whiteKeyAspectRatio,
    blackKeyHeight,
    isFixedHeight,
    components,
    ...htmlAttributes
  } = props;
  const note = midiToNote(midiNumber);
  const Component = getKeyComponent(components, note.keyColor);
  const style = useMemo(
    () => getKeyStyles(midiNumber, firstNoteMidiNumber, isFixedHeight, whiteKeyAspectRatio, blackKeyHeight),
    [midiNumber, firstNoteMidiNumber, isFixedHeight, whiteKeyAspectRatio, blackKeyHeight]
  );

  return (
    <div style={style} {...htmlAttributes} data-midi-number={midiNumber}>
      <Component active={active} note={note} />
    </div>
  );
});

function getKeyStyles(
  midiNumber: number,
  firstNoteMidiNumber: number,
  isFixedHeight: boolean,
  whiteKeyAspectRatio: React.CSSProperties['aspectRatio'] = DEFAULT_WHITE_KEY_ASPECT_RATIO,
  blackKeyHeight: React.CSSProperties['height'] = DEFAULT_BLACK_KEY_HEIGHT
): React.CSSProperties {
  const WHITE_KEY_COLUMN_SPAN = 12;
  const BLACK_KEY_COLUMN_SPAN = 8;
  const position = getKeyPosition(midiNumber, firstNoteMidiNumber);
  const { keyColor } = midiToNote(midiNumber);
  switch (keyColor) {
    case 'white':
      return {
        position: 'relative',
        boxSizing: 'border-box',
        gridRow: '1 / span 1',
        aspectRatio: isFixedHeight ? undefined : whiteKeyAspectRatio,
        gridColumn: `${position} / span ${WHITE_KEY_COLUMN_SPAN}`,
      };
    case 'black':
      return {
        position: 'relative',
        zIndex: 1,
        boxSizing: 'border-box',
        gridRow: '1 / span 1',
        height: blackKeyHeight,
        gridColumn: `${position} / span ${BLACK_KEY_COLUMN_SPAN}`,
      };
  }
}

function getKeyComponent(components: KeyProps['components'], color: KeyColor) {
  return components?.[`${color}Key`] ?? defaultKeyComponents[`${color}Key`];
}

// The keyboard is laid out on a horizontal CSS grid.
// Position represents a starting column: `grid-column-start` in CSS terms.
// White keys span over 12 columns each, making the octave length 84 columns total.
// Black keys span over 8 columns each, and are overlaid on top white keys.
// Key positions (starting columns) of a single octave are calculated by hand to match a real piano keyboard as closely as possible.
function getAbsoluteKeyPosition(midiNumber: number) {
  const KEY_POSITIONS = [1, 8, 13, 22, 25, 37, 44, 49, 57, 61, 70, 73];
  const OCTAVE_LENGTH_IN_COLUMNS = 84;
  const { octave } = midiToNote(midiNumber);
  return octave * OCTAVE_LENGTH_IN_COLUMNS + KEY_POSITIONS[midiNumber % KEY_POSITIONS.length];
}

function getKeyPosition(midiNumber: number, firstNoteMidiNumber: number) {
  return getAbsoluteKeyPosition(midiNumber) - getAbsoluteKeyPosition(firstNoteMidiNumber) + 1;
}

export type { KeyProps };
export { Key };
