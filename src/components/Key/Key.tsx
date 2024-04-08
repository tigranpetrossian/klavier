import React from 'react';
import { midiToNote } from 'utils/midi';
import type { CSSProperties, KeyColor, KlavierKeyProps } from 'types';

type KeyProps = {
  midiNumber: number;
  firstNoteMidiNumber: number;
  components: {
    blackKey: React.ComponentType<KlavierKeyProps>;
    whiteKey: React.ComponentType<KlavierKeyProps>;
  };
  active: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

const Key = React.memo((props: KeyProps) => {
  const { active, midiNumber, firstNoteMidiNumber, components, ...htmlAttributes } = props;
  const { keyColor } = midiToNote(midiNumber);
  const position = getKeyPosition(midiNumber, firstNoteMidiNumber);
  const Component = getKeyComponent(components, keyColor);

  return (
    <Component
      active={active}
      style={
        {
          ...layoutStyles[keyColor],
          '--grid-column-start': position,
        } as CSSProperties
      }
      data-midi-number={midiNumber}
      {...htmlAttributes}
    />
  );
});

const layoutStyles = {
  black: {
    position: 'relative',
    zIndex: 1,
    boxSizing: 'borderBox',
    aspectRatio: '15 / 100',
    gridColumn: 'var(--grid-column-start) / span 8',
    gridRow: '1 / span 1',
  },
  white: {
    position: 'relative',
    boxSizing: 'borderBox',
    aspectRatio: '23 / 150',
    gridColumn: 'var(--grid-column-start) / span 12',
    gridRow: '1 / span 1',
  },
};

function getKeyComponent(components: KeyProps['components'], color: KeyColor) {
  return components[`${color}Key`];
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

export type { KeyProps };
export { Key };
