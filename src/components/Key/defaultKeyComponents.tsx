import type { CustomKeyProps } from 'types';

const WhiteKey = (props: CustomKeyProps) => {
  const { innerProps, active } = props;

  return (
    <div
      {...innerProps}
      style={{
        ...innerProps.style,
        backgroundColor: active ? 'red' : 'white',
        border: '1px solid #000',
        borderRadius: '0 0 2px 2px',
      }}
    />
  );
};

const BlackKey = (props: CustomKeyProps) => {
  const { innerProps, active } = props;

  return (
    <div
      {...innerProps}
      style={{
        ...innerProps.style,
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
