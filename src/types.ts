import type React from 'react';

export type KeyColor = 'black' | 'white';

export type Note = {
  keyColor: KeyColor;
  midiNumber: number;
  octave: number;
};

export type KeymapItem = { key: string; midiNumber: number };

export type Keymap = Array<KeymapItem>;

export type CustomKeyProps = {
  active: boolean;
  note: Note;
};

export type CustomKeyComponent = React.ComponentType<CustomKeyProps>;
