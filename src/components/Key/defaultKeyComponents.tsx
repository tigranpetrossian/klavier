import type { CustomKeyProps } from 'types';

const WhiteKey = (props: CustomKeyProps) => {
  const { active } = props;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: active ? 'red' : 'white',
        border: '1px solid #000',
        borderRadius: '0 0 2px 2px',
      }}
    />
  );
};

const BlackKey = (props: CustomKeyProps) => {
  const { active } = props;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: active ? 'red' : 'black',
        borderRadius: '0 0 2px 2px',
      }}
    />
  );
};

export const defaultKeyComponents = {
  blackKey: BlackKey,
  whiteKey: WhiteKey,
};
