'use client';

import { Select } from '@base-ui/react/select';
import type { ReactNode } from 'react';
import { classNames } from './class-names';
import { Lamp } from './lamp';
import './lighting.css';
import './surface.css';
import './recess.css';
import './legend.css';
import './key.css';
import './screen.css';
import './selector.css';

type ChevronDirection = 'left' | 'right' | 'down';

const CHEVRON_ROTATION: Record<ChevronDirection, number> = { down: 0, left: 90, right: -90 };

type SelectorOption<T extends string> = { value: T; label: string };

type SelectorProps<T extends string> = {
  value: T;
  onValueChange(value: NoInfer<T>): void;
  options: readonly SelectorOption<T>[];
  'aria-label': string;
  disabled?: boolean;
  className?: string;
};

function Selector<T extends string>(props: SelectorProps<T>) {
  const { value, onValueChange, options, disabled, className } = props;
  const select = (next: T | null) => {
    if (next !== null) onValueChange(next);
  };
  const step = (offset: number) => {
    const next = neighbour(options, value, offset);
    if (next !== undefined) onValueChange(next.value);
  };
  return (
    <div className={classNames('hw-Selector', className)}>
      <StepButton label="Previous" disabled={disabled} onPress={() => step(-1)}>
        <Chevron direction="left" />
      </StepButton>
      <Select.Root items={options} value={value} disabled={disabled} onValueChange={select}>
        <Select.Trigger className="hw-Screen hw-Recess hw-SelectorDisplay" aria-label={props['aria-label']}>
          <span className="hw-ScreenGlass">
            <span className="hw-SelectorReadout hw-LegendType">
              <Select.Value className="hw-SelectorValue" />
              <Select.Icon className="hw-SelectorIcon">
                <Chevron direction="down" />
              </Select.Icon>
            </span>
          </span>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner className="hw-SelectorPositioner" sideOffset={8} alignItemWithTrigger={false}>
            <Select.Popup className="hw-SelectorPopup">
              <Select.List>
                {options.map((option) => (
                  <Select.Item key={option.value} value={option.value} className="hw-SelectorItem hw-LegendType">
                    <Lamp shape="round" on={option.value === value} />
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <StepButton label="Next" disabled={disabled} onPress={() => step(1)}>
        <Chevron direction="right" />
      </StepButton>
    </div>
  );
}

type StepButtonProps = { label: string; disabled?: boolean; onPress(): void; children: ReactNode };

function StepButton({ label, disabled, onPress, children }: StepButtonProps) {
  return (
    <button
      type="button"
      className="hw-Key hw-Recess hw-LegendType"
      data-shape="square"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

function Chevron({ direction }: { direction: ChevronDirection }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      aria-hidden
      style={{ rotate: `${CHEVRON_ROTATION[direction]}deg` }}
    >
      <path
        d="M0.75 2.75L4.5 6.5L8.25 2.75"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function neighbour<T extends string>(
  options: readonly SelectorOption<T>[],
  value: T,
  offset: number
): SelectorOption<T> | undefined {
  if (options.length === 0) return undefined;
  const index = options.findIndex((option) => option.value === value);
  return options[(Math.max(index, 0) + offset + options.length) % options.length];
}

export { Selector };
export type { SelectorOption, SelectorProps };
