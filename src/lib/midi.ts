import type { Note } from 'types';
import { MIDI_NUMBER_MIN, MIDI_NUMBER_MAX, MIDI_NUMBER_C0, OCTAVE_LENGTH, BLACK_KEY_MIDI_NUMBERS } from 'lib/constants';

export function midiToNote(midiNumber: number): Note {
  if (!isMidiNumber(midiNumber)) {
    throw new Error(`getMidiNoteAttributes expects a valid midi number: 0-127, received ${midiNumber}`);
  }

  return {
    midiNumber,
    keyColor: isBlackKey(midiNumber) ? 'black' : 'white',
    octave: Math.floor((midiNumber - MIDI_NUMBER_C0) / OCTAVE_LENGTH),
  };
}

export function isMidiNumber(input: unknown): input is number {
  return typeof input === 'number' && Number.isInteger(input) && input >= MIDI_NUMBER_MIN && input <= MIDI_NUMBER_MAX;
}

export function isBlackKey(midiNumber: number) {
  return isMidiNumber(midiNumber) && BLACK_KEY_MIDI_NUMBERS.includes(midiNumber);
}

export function isWhiteKey(midiNumber: number) {
  return isMidiNumber(midiNumber) && !BLACK_KEY_MIDI_NUMBERS.includes(midiNumber);
}
