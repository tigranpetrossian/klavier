import type { KlavierKeyProps } from 'types';

const WhiteKey = (props: KlavierKeyProps) => {
  const { style, active, ...other } = props;

  return (
    <div
      {...other}
      style={{
        ...style,
        backgroundColor: active ? 'red' : 'white',
        border: '1px solid #000',
        borderRadius: '0 0 2px 2px',
      }}
    />
  );
};

const BlackKey = (props: KlavierKeyProps) => {
  const { style, active, ...other } = props;

  return (
    <div
      {...other}
      style={{
        ...style,
        backgroundColor: active ? 'red' : 'black',
        borderRadius: '0 0 2px 2px',
      }}
    />
  );
};

export const flat = {
  blackKey: BlackKey,
  whiteKey: WhiteKey,
};
