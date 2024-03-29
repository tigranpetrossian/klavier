import styles from 'klavier.module.css';
import React from 'react';
import { midiToNote } from 'midi/midi.utils.ts';

type Props = {
  midiNumber: number;
};

const classNames = {
  black: styles.blackKey,
  white: styles.whiteKey,
};

export const Key = (props: Props) => {
  const { midiNumber } = props;
  const { keyColor } = midiToNote(midiNumber);

  return <div className={classNames[keyColor]} />;
};
