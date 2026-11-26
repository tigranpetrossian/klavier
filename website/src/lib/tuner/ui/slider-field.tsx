import { Slider, ValueField } from 'figma-kit';
import { useRef, type PointerEvent, type ReactNode } from 'react';
import { numericDisplay } from './numeric-display';
import { useFieldName } from './row';

export type SliderFieldProps = {
  value: number;
  onValueChange(value: number): void;
  onReset?(): void;
  min: number;
  max: number;
  step?: number;
  scale?: number;
  precision?: number;
  suffix?: string;
  icon?: ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
};

const DEFAULT_STEP = 1;
const DEFAULT_SCALE = 1;
const THUMB_SELECTOR = '.fp-SliderThumb';

export function SliderField(props: SliderFieldProps) {
  const { value, onValueChange, onReset, min, max, step = DEFAULT_STEP, scale = DEFAULT_SCALE } = props;
  const { suffix, icon, disabled } = props;
  const name = useFieldName(props['aria-label']);
  const display = numericDisplay(step, scale, props.precision);
  const pressedThumb = useRef(false);
  const resetOnThumb = () => {
    if (!onReset || !pressedThumb.current) return;
    onReset();
  };
  return (
    <ValueField.Multi className="tuner-SliderField" disabled={disabled}>
      <Slider
        {...name}
        size="small"
        min={min}
        max={max}
        step={step}
        rangeAnchor={spansZero(min, max) ? 0 : undefined}
        value={[value]}
        onValueChange={([next = value]) => onValueChange(next)}
        onPointerDownCapture={(event: PointerEvent) => {
          pressedThumb.current = isThumb(event.target);
        }}
        onDoubleClick={resetOnThumb}
      />
      <ValueField.Root>
        <ValueField.Scrubber />
        <ValueField.Numeric
          {...name}
          value={value}
          onChange={onValueChange}
          min={min}
          max={max}
          scale={scale}
          suffix={suffix}
          {...display}
        />
        {icon !== undefined && <ValueField.Label>{icon}</ValueField.Label>}
      </ValueField.Root>
    </ValueField.Multi>
  );
}

function spansZero(min: number, max: number): boolean {
  return min < 0 && max > 0;
}

function isThumb(target: EventTarget): boolean {
  return target instanceof Element && target.closest(THUMB_SELECTOR) !== null;
}
