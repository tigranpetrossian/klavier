import React from 'react';
import styles from 'klavier.module.css';
import { midiToNote } from 'utils/midi';
import type { KeyColor } from 'types';

type Props = {
  midiNumber: number;
  firstNoteMidiNumber: number;
  active: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const Key = React.memo((props: Props) => {
  const { active, midiNumber, firstNoteMidiNumber, ...htmlAttributes } = props;
  const { keyColor } = midiToNote(midiNumber);
  const position = getKeyPosition(midiNumber, firstNoteMidiNumber);

  return (
    <div
      className={buildClassName(keyColor, active)}
      style={{ '--grid-column-start': position } as React.CSSProperties}
      data-midi-number={midiNumber}
      {...htmlAttributes}
    />
  );
});

const classNames = {
  black: styles.blackKey,
  white: styles.whiteKey,
};

function buildClassName(color: KeyColor, active: boolean) {
  const baseClass = classNames[color];
  return active ? `${baseClass} active` : baseClass;
}

// The keyboard is laid out on a horizontal CSS grid.
// Position represents a starting column: `grid-column-start` in CSS terms.
// White keys span over 12 columns each, making the octave length 84 columns total.
// Black keys span over 8 columns each, and are overlaid on top white keys.
// Key positions (starting columns) of a single octave are calculated by hand to match a real piano keyboard as closely as possible.
const KEY_POSITIONS = [1, 8, 13, 22, 25, 37, 44, 49, 57, 61, 70, 73];
const OCTAVE_LENGTH_IN_COLUMNS = 84;
function getAbsoluteKeyPosition(midiNumber: number) {
  const { octave } = midiToNote(midiNumber);
  return octave * OCTAVE_LENGTH_IN_COLUMNS + KEY_POSITIONS[midiNumber % KEY_POSITIONS.length];
}

function getKeyPosition(midiNumber: number, firstNoteMidiNumber: number) {
  return getAbsoluteKeyPosition(midiNumber) - getAbsoluteKeyPosition(firstNoteMidiNumber) + 1;
}
