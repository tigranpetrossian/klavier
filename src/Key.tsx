import styles from 'klavier.module.css';
import React from 'react';
import { midiToNote } from 'midi/midi.utils.ts';

type Props = {
  midiNumber: number;
  firstNoteMidiNumber: number;
  active: boolean;
};

const classNames = {
  black: styles.blackKey,
  white: styles.whiteKey,
};

export const Key = (props: Props) => {
  const { midiNumber, firstNoteMidiNumber } = props;
  const { keyColor } = midiToNote(midiNumber);
  const position = getKeyPosition(midiNumber, firstNoteMidiNumber);

  return (
    <div
      className={classNames[keyColor]}
      style={{ '--grid-column-start': position } as React.CSSProperties}
    />
  );
};

// The keyboard is laid out on a horizontal CSS grid with a 1px gap.
// Position represents a starting column: `grid-column-start` in CSS terms.
// White keys span over 12 columns each, making the octave length 84 columns total.
// Black keys span over 8 columns each, and are overlaid on top white keys.
// Key positions (starting columns) are calculated by hand to match a real piano keyboard as closely as possible.
function getAbsoluteKeyPosition(midiNumber: number) {
  const KEY_POSITIONS = [1, 8, 13, 22, 25, 37, 44, 49, 57, 61, 70, 73];
  const OCTAVE_LENGTH_IN_COLUMNS = 84;
  const { octave } = midiToNote(midiNumber);
  return octave * OCTAVE_LENGTH_IN_COLUMNS + KEY_POSITIONS[midiNumber % KEY_POSITIONS.length];
}

function getKeyPosition(midiNumber: number, firstNoteMidiNumber: number) {
  return getAbsoluteKeyPosition(midiNumber) - getAbsoluteKeyPosition(firstNoteMidiNumber) + 1;
}
