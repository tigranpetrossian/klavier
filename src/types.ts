import type React from 'react';

export type KeyColor = 'black' | 'white';
export type Note = {
  keyColor: KeyColor;
  midiNumber: number;
  octave: number;
};
export type KlavierKeymapItem = { key: string; midiNumber: number };
export type KlavierKeymap = Array<KlavierKeymapItem>;
export type KlavierKeyInnerProps = {
  active: boolean;
} & React.HTMLAttributes<HTMLElement>;
export interface CSSProperties extends React.CSSProperties {
  '--grid-column-start'?: number;
}
