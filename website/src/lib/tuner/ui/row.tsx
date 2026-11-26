import { Text } from 'figma-kit';
import { createContext, use, useId, type ComponentProps } from 'react';
import { addClassName } from './add-class-name';

type RootProps = ComponentProps<'div'> & { inline?: boolean };

type FieldProps = ComponentProps<'div'> & { span?: 1 | 2 };

export type FieldNameProps = { 'aria-label'?: string; 'aria-labelledby'?: string };

const RowInlineContext = createContext(false);
const FieldLabelContext = createContext<string | undefined>(undefined);

function Root({ inline = false, className, ...props }: RootProps) {
  return (
    <RowInlineContext value={inline}>
      <div {...props} data-inline={inline ? '' : undefined} className={addClassName('tuner-Row', className)} />
    </RowInlineContext>
  );
}

function Field({ span = 1, className, ...props }: FieldProps) {
  const labelId = useId();
  return (
    <FieldLabelContext value={labelId}>
      <div {...props} data-span={span} className={addClassName('tuner-RowField', className)} />
    </FieldLabelContext>
  );
}

function Label({ className, ...props }: ComponentProps<typeof Text>) {
  const inline = use(RowInlineContext);
  const labelId = use(FieldLabelContext);
  return (
    <Text
      id={labelId}
      size={inline ? '3' : '1'}
      color="secondary"
      {...props}
      className={addClassName('tuner-RowLabel', className)}
    />
  );
}

function Rail({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={addClassName('tuner-RowRail', className)} />;
}

export function useFieldName(ariaLabel: string | undefined): FieldNameProps {
  const labelId = use(FieldLabelContext);
  return ariaLabel === undefined && labelId !== undefined
    ? { 'aria-labelledby': labelId }
    : { 'aria-label': ariaLabel };
}

export const Row = { Root, Field, Label, Rail };
