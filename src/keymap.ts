import type { Keymap } from 'types';

export const TOP_ROW: Keymap = [
  { key: 'q', midiNumber: 60 },
  { key: '2', midiNumber: 61 },
  { key: 'w', midiNumber: 62 },
  { key: '3', midiNumber: 63 },
  { key: 'e', midiNumber: 64 },
  { key: 'r', midiNumber: 65 },
  { key: '5', midiNumber: 66 },
  { key: 't', midiNumber: 67 },
  { key: '6', midiNumber: 68 },
  { key: 'y', midiNumber: 69 },
  { key: '7', midiNumber: 70 },
  { key: 'u', midiNumber: 71 },
  { key: 'i', midiNumber: 72 },
  { key: '9', midiNumber: 73 },
  { key: 'o', midiNumber: 74 },
  { key: '0', midiNumber: 75 },
  { key: 'p', midiNumber: 76 },
  { key: '[', midiNumber: 77 },
  { key: '=', midiNumber: 78 },
  { key: ']', midiNumber: 79 },
];

export const BOTTOM_ROW: Keymap = [
  { key: 'z', midiNumber: 48 },
  { key: 's', midiNumber: 49 },
  { key: 'x', midiNumber: 50 },
  { key: 'd', midiNumber: 51 },
  { key: 'c', midiNumber: 52 },
  { key: 'v', midiNumber: 53 },
  { key: 'g', midiNumber: 54 },
  { key: 'b', midiNumber: 55 },
  { key: 'h', midiNumber: 56 },
  { key: 'n', midiNumber: 57 },
  { key: 'j', midiNumber: 58 },
  { key: 'm', midiNumber: 59 },
  { key: ',', midiNumber: 60 },
  { key: '', midiNumber: 61 },
  { key: '', midiNumber: 62 },
  { key: '', midiNumber: 63 },
  { key: '', midiNumber: 64 },
  { key: '', midiNumber: 65 },
  { key: '', midiNumber: 66 },
  { key: '', midiNumber: 67 },
];

export const DEFAULT_KEYMAP: Keymap = [...TOP_ROW, ...BOTTOM_ROW];
