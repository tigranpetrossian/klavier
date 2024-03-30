import type { Note } from 'types.ts';
import {
  BLACK_KEY_MIDI_NUMBERS,
  MAX_MIDI_NUMBER,
  MIDI_NUMBER_C0,
  MIN_MIDI_NUMBER,
  OCTAVE_LENGTH,
} from './midi.constants.ts';

export function midiToNote(midiNumber: number): Note {
  if (!isMidiNumber(midiNumber)) {
    throw new Error(
      `getMidiNoteAttributes expects a valid midi number: 0-127, received ${midiNumber}`
    );
  }

  return {
    midiNumber,
    keyColor: isBlackKey(midiNumber) ? 'black' : 'white',
    octave: Math.floor((midiNumber - MIDI_NUMBER_C0) / OCTAVE_LENGTH),
  };
}

export function isMidiNumber(input: unknown): input is number {
  return (
    typeof input === 'number' &&
    Number.isInteger(input) &&
    input >= MIN_MIDI_NUMBER &&
    input <= MAX_MIDI_NUMBER
  );
}

export function isBlackKey(midiNumber: number) {
  return isMidiNumber(midiNumber) && BLACK_KEY_MIDI_NUMBERS.includes(midiNumber);
}

export function isWhiteKey(midiNumber: number) {
  return isMidiNumber(midiNumber) && !BLACK_KEY_MIDI_NUMBERS.includes(midiNumber);
}
