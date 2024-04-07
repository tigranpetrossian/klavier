import type React from 'react';

export type KeyColor = 'black' | 'white';
export type Note = {
  keyColor: KeyColor;
  midiNumber: number;
  octave: number;
};
export type KeymapItem = { computerKey: string; midiNumber: number };
export type Keymap = Array<KeymapItem>;
export type KlavierKeyProps = {
  active: boolean;
} & React.HTMLAttributes<HTMLElement>;

export interface CSSProperties extends React.CSSProperties {
  '--grid-column-start'?: number;
}
