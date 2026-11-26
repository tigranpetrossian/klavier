'use client';

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';
import { classNames } from './class-names';
import { Lamp } from './lamp';
import './lighting.css';
import './surface.css';
import './recess.css';
import './legend.css';
import './key.css';
import './segmented-control.css';

type SegmentOption<T extends string> = { value: T; label: ReactNode };

type SegmentedControlProps<T extends string> = {
  value: T;
  onValueChange(value: NoInfer<T>): void;
  options: readonly SegmentOption<T>[];
  'aria-label': string;
  lamps?: boolean;
  disabled?: boolean;
  className?: string;
};

function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  const { value, onValueChange, options, lamps = true, disabled, className } = props;
  return (
    <RadioGroup
      className={classNames('hw-Segmented hw-Recess', className)}
      aria-label={props['aria-label']}
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
      style={{ '--segment-count': options.length }}
    >
      {options.map((option, index) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className="hw-Key hw-Segment hw-LegendType"
          style={{ '--segment-index': index }}
        >
          {lamps && <Lamp on={option.value === value} />}
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

export { SegmentedControl };
export type { SegmentedControlProps, SegmentOption };
