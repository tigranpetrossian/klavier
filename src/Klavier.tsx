import classNames from 'klavier.module.css';
import { Key } from 'Key.tsx';
import { range } from 'utils.ts';
import { isMidiNumber } from 'midi/midi.utils.ts';
import { useKlavier } from 'useKlavier.ts';

export interface KlavierProps {
  noteRange?: [number, number];
  defaultActiveNotes?: Array<number>;
  activeNotes?: Array<number>;
  onPlayNote?: (midiNumber: number) => void;
  onStopNote?: (midiNumber: number) => void;
}

export const Klavier = (props: KlavierProps) => {
  const { defaultActiveNotes, activeNotes, onPlayNote, onStopNote, noteRange = [21, 108] } = props;
  const [first, last] = noteRange;
  const {
    state,
    actions: { playNote, stopNote, setMouseActive },
  } = useKlavier({
    defaultActiveNotes,
    activeNotes,
    onPlayNote,
    onStopNote,
  });
  validateRange(noteRange);

  const handleGlobalMouseUp = () => {
    setMouseActive(false);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
  };

  const handleMouseEvents = (event: React.MouseEvent) => {
    const dataNumber = event.currentTarget.getAttribute('data-number');
    if (!dataNumber) {
      return;
    }
    const midiNumber = parseInt(dataNumber);

    switch (event.type) {
      case 'mousedown':
        window.addEventListener('mouseup', handleGlobalMouseUp);
        setMouseActive(true);
        playNote(midiNumber);
        break;
      case 'mouseup':
      case 'mouseleave':
        if (state.mouseActive) {
          stopNote(midiNumber);
        }
        break;
      case 'mouseenter':
        if (state.mouseActive) {
          playNote(midiNumber);
        }
        break;
    }
  };

  return (
    <div className={classNames.klavier}>
      {range(first, last + 1).map((midiNumber) => (
        <Key
          key={midiNumber}
          midiNumber={midiNumber}
          firstNoteMidiNumber={first}
          active={state.activeNotes.includes(midiNumber)}
          data-number={midiNumber}
          onMouseDown={handleMouseEvents}
          onMouseUp={handleMouseEvents}
          onMouseLeave={handleMouseEvents}
          onMouseEnter={handleMouseEvents}
        />
      ))}
    </div>
  );
};

const ERRORS = {
  INVALID_MIDI_VALUES: 'Note range must be within valid MIDI numbers (0-127).',
  INVALID_RANGE_ORDER: 'The last note must be greater than the first.',
};

function validateRange([first, last]: [number, number]) {
  const receivedRangeDisplay = `Received range: [${first}, ${last}]`;

  if (!isMidiNumber(first) || !isMidiNumber(last)) {
    throw new Error(`${ERRORS.INVALID_MIDI_VALUES} ${receivedRangeDisplay}`);
  }

  if (first >= last) {
    throw new Error(`${ERRORS.INVALID_RANGE_ORDER} ${receivedRangeDisplay}`);
  }
}
