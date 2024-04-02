export type KeyColor = 'black' | 'white';
export type Note = {
  keyColor: KeyColor;
  midiNumber: number;
  octave: number;
};
export type KeymapItem = { computerKey: string; midiNumber: number };
export type Keymap = Array<KeymapItem>;
