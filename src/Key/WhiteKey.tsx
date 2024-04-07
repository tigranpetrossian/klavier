import React from 'react';
import styles from 'klavier.module.css';

type WhiteKeyProps = {
  active: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const WhiteKey = (props: WhiteKeyProps) => {
  const { active, ...htmlAttributes } = props;
  const className = active ? `${styles.whiteKey} active` : styles.whiteKey;

  return <div className={className} {...htmlAttributes} />;
};
