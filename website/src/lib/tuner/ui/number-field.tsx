import { ValueField } from 'figma-kit';
import type { ReactNode } from 'react';
import { numericDisplay } from './numeric-display';
import { useFieldName } from './row';

export type NumberFieldProps = {
  value: number;
  onValueChange(value: number): void;
  min?: number;
  max?: number;
  step?: number;
  scale?: number;
  precision?: number;
  suffix?: string;
  icon?: ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
};

export type NumericSelectFieldProps = Omit<NumberFieldProps, 'icon'> & {
  options: readonly number[];
  onPreviewChange?(value: number | null): void;
};

const DEFAULT_STEP = 1;
const DEFAULT_SCALE = 1;

export function NumberField(props: NumberFieldProps) {
  const { value, onValueChange, min, max, step = DEFAULT_STEP, scale = DEFAULT_SCALE, suffix, icon } = props;
  const name = useFieldName(props['aria-label']);
  return (
    <ValueField.Root disabled={props.disabled}>
      {icon === undefined ? (
        <ValueField.Scrubber />
      ) : (
        <ValueField.Scrubber>
          <ValueField.Label>{icon}</ValueField.Label>
        </ValueField.Scrubber>
      )}
      <ValueField.Numeric
        {...name}
        value={value}
        onChange={onValueChange}
        min={min}
        max={max}
        scale={scale}
        suffix={suffix}
        {...numericDisplay(step, scale, props.precision)}
      />
    </ValueField.Root>
  );
}

export function NumericSelectField(props: NumericSelectFieldProps) {
  const { value, onValueChange, onPreviewChange, options, min, max, suffix } = props;
  const { step = DEFAULT_STEP, scale = DEFAULT_SCALE } = props;
  const name = useFieldName(props['aria-label']);
  return (
    <div className="tuner-NumericSelectField">
      <ValueField.NumericSelect
        {...name}
        value={value}
        onChange={onValueChange}
        onItemHighlighted={(highlighted) => onPreviewChange?.(highlighted ?? null)}
        options={options}
        min={min}
        max={max}
        scale={scale}
        suffix={suffix}
        disabled={props.disabled}
        {...numericDisplay(step, scale, props.precision)}
      />
    </div>
  );
}
