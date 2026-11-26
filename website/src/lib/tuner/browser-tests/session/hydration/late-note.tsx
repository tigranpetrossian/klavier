import { tunable } from '@/lib/tuner/tunable';

export const LATE_NOTE = tunable('hydration.late-note', 'Late note');
export const NOTE_LENGTH = LATE_NOTE.length;

export function LateNote() {
  return (
    <p data-testid="late-note">
      {LATE_NOTE} ({NOTE_LENGTH})
    </p>
  );
}
