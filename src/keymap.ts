import type { Keymap } from 'types.ts';

export const TOP_ROW: Keymap = [
  { computerKey: 'q', midiNumber: 60 },
  { computerKey: '2', midiNumber: 61 },
  { computerKey: 'w', midiNumber: 62 },
  { computerKey: '3', midiNumber: 63 },
  { computerKey: 'e', midiNumber: 64 },
  { computerKey: 'r', midiNumber: 65 },
  { computerKey: '5', midiNumber: 66 },
  { computerKey: 't', midiNumber: 67 },
  { computerKey: '6', midiNumber: 68 },
  { computerKey: 'y', midiNumber: 69 },
  { computerKey: '7', midiNumber: 70 },
  { computerKey: 'u', midiNumber: 71 },
  { computerKey: 'i', midiNumber: 72 },
  { computerKey: '9', midiNumber: 73 },
  { computerKey: 'o', midiNumber: 74 },
  { computerKey: '0', midiNumber: 75 },
  { computerKey: 'p', midiNumber: 76 },
  { computerKey: '[', midiNumber: 77 },
  { computerKey: '=', midiNumber: 78 },
  { computerKey: ']', midiNumber: 79 },
];

export const BOTTOM_ROW: Keymap = [
  { computerKey: 'z', midiNumber: 48 },
  { computerKey: 's', midiNumber: 49 },
  { computerKey: 'x', midiNumber: 50 },
  { computerKey: 'd', midiNumber: 51 },
  { computerKey: 'c', midiNumber: 52 },
  { computerKey: 'v', midiNumber: 53 },
  { computerKey: 'g', midiNumber: 54 },
  { computerKey: 'b', midiNumber: 55 },
  { computerKey: 'h', midiNumber: 56 },
  { computerKey: 'n', midiNumber: 57 },
  { computerKey: 'j', midiNumber: 58 },
  { computerKey: 'm', midiNumber: 59 },
  { computerKey: ',', midiNumber: 60 },
  { computerKey: '', midiNumber: 61 },
  { computerKey: '', midiNumber: 62 },
  { computerKey: '', midiNumber: 63 },
  { computerKey: '', midiNumber: 64 },
  { computerKey: '', midiNumber: 65 },
  { computerKey: '', midiNumber: 66 },
  { computerKey: '', midiNumber: 67 },
];

export const DEFAULT_KEYMAP: Keymap = [...TOP_ROW, ...BOTTOM_ROW];
