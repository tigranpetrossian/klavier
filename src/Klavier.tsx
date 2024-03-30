import classNames from 'klavier.module.css';
import { Key } from 'Key.tsx';
import { range } from 'utils.ts';
import { isMidiNumber } from 'midi/midi.utils.ts';

export interface KlavierProps {
  activeNotes?: Array<number>;
  noteRange?: [number, number];
}

export const Klavier = (props: KlavierProps) => {
  const { activeNotes = [], noteRange = [21, 108] } = props;
  const [first, last] = noteRange;
  validateRange(noteRange);

  return (
    <div className={classNames.klavier}>
      {range(first, last + 1).map((midiNumber) => (
        <Key
          key={midiNumber}
          midiNumber={midiNumber}
          firstNoteMidiNumber={first}
          active={activeNotes.includes(midiNumber)}
        />
      ))}
    </div>
  );
};

const ERRORS = {
  INVALID_MIDI_VALUES: 'Note range must be within valid MIDI numbers (0-127).',
  INVALID_RANGE_ORDER: 'The last note must be greater than the first.',
};

function validateRange([first, last]: KlavierProps['noteRange']) {
  const receivedRangeDisplay = `Received range: [${first}, ${last}]`;

  if (!isMidiNumber(first) || !isMidiNumber(last)) {
    throw new Error(`${ERRORS.INVALID_MIDI_VALUES} ${receivedRangeDisplay}`);
  }

  if (first >= last) {
    throw new Error(`${ERRORS.INVALID_RANGE_ORDER} ${receivedRangeDisplay}`);
  }
}
