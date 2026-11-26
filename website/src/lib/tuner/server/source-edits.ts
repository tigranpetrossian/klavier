export type SourceEdit = { start: number; end: number; text: string };

export function applyEdits(text: string, edits: readonly SourceEdit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end), text);
}
