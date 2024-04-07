import React from 'react';
import styles from 'klavier.module.css';

type BlackKeyProps = {
  active: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const BlackKey = (props: BlackKeyProps) => {
  const { active, ...htmlAttributes } = props;
  const className = active ? `${styles.blackKey} active` : styles.blackKey;

  return <div className={className} {...htmlAttributes} />;
};
