import classNames from 'klavier.module.css';
import { Key } from 'Key.tsx';
import { range } from 'utils.ts';

export interface KlavierProps {
  activeNotes?: Array<number>;
  noteRange?: [number, number];
}

export const Klavier = (props: KlavierProps) => {
  const { activeNotes = [], noteRange = [21, 108] } = props;
  const [first, last] = noteRange;

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
