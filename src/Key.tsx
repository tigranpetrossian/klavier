import classNames from 'klavier.module.css';
import { KeyColor } from 'types.ts';
import React from 'react';

type Props = {
  color: KeyColor;
};

export const Key = (props: Props) => {
  const { color } = props;
  const className = color === 'white' ? classNames.whiteKey : classNames.blackKey;

  return <div className={className} />;
};
