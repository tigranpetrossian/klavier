import { SegmentedControl, Tooltip } from 'figma-kit';
import type { ReactNode } from 'react';
import { useFieldName } from './row';

export type SegmentedOption<T extends string = string> = { value: T; label: string; icon?: ReactNode };

export type SegmentedFieldProps<T extends string> = {
  value: T;
  onValueChange(value: T): void;
  options: readonly SegmentedOption<T>[];
  disabled?: boolean;
  'aria-label'?: string;
};

export function SegmentedField<T extends string>(props: SegmentedFieldProps<T>) {
  const { value, onValueChange, options, disabled } = props;
  const name = useFieldName(props['aria-label']);
  const choose = (next: string) => {
    const option = options.find((candidate) => candidate.value === next);
    if (option === undefined) return;
    onValueChange(option.value);
  };
  return (
    <SegmentedControl.Root {...name} value={value} onValueChange={choose} disabled={disabled} fullWidth>
      {options.map((option) =>
        option.icon === undefined ? (
          <SegmentedControl.Item key={option.value} value={option.value}>
            <SegmentedControl.Text>{option.label}</SegmentedControl.Text>
          </SegmentedControl.Item>
        ) : (
          <Tooltip key={option.value} content={option.label}>
            <SegmentedControl.Item value={option.value} aria-label={option.label}>
              {option.icon}
            </SegmentedControl.Item>
          </Tooltip>
        )
      )}
    </SegmentedControl.Root>
  );
}
