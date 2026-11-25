type NoteByInputId = ReadonlyMap<string, number>;

interface NoteChanges {
  started: number[];
  ended: number[];
}

const EMPTY_NOTE_BY_INPUT_ID: NoteByInputId = new Map();

function press(noteByInputId: NoteByInputId, inputId: string, note: number): NoteByInputId {
  return noteByInputId.get(inputId) === note ? noteByInputId : new Map(noteByInputId).set(inputId, note);
}

function release(noteByInputId: NoteByInputId, shouldRelease: (inputId: string) => boolean): NoteByInputId {
  const kept = [...noteByInputId].filter(([inputId]) => !shouldRelease(inputId));
  return kept.length === noteByInputId.size ? noteByInputId : new Map(kept);
}

function pressedNotes(noteByInputId: NoteByInputId): ReadonlySet<number> {
  return new Set(noteByInputId.values());
}

function noteChanges(before: NoteByInputId, after: NoteByInputId): NoteChanges {
  const notesBefore = pressedNotes(before);
  const notesAfter = pressedNotes(after);

  return {
    started: [...notesAfter].filter((note) => !notesBefore.has(note)),
    ended: [...notesBefore].filter((note) => !notesAfter.has(note)),
  };
}

export { EMPTY_NOTE_BY_INPUT_ID, press, release, pressedNotes, noteChanges };
export type { NoteByInputId };
