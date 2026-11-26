'use client';

import { Slider as BaseSlider } from '@base-ui/react/slider';
import { classNames } from './class-names';
import { clamp, normalize } from './number-range';
import './lighting.css';
import './surface.css';
import './recess.css';
import './slider.css';

const SLIDER_DEFAULT_LENGTH = 168;
const SLIDER_DEFAULT_TICKS = 11;
const MAJOR_TICK_INTERVAL = 5;

type SliderOrientation = 'vertical' | 'horizontal';

type SliderProps = {
  value: number;
  onValueChange(value: number): void;
  'aria-label': string;
  min?: number;
  max?: number;
  step?: number;
  orientation?: SliderOrientation;
  length?: number;
  ticks?: number;
  fill?: boolean;
  meter?: number;
  disabled?: boolean;
  className?: string;
};

function Slider(props: SliderProps) {
  const { value, onValueChange, min = 0, max = 1, step = 0.01, orientation = 'vertical' } = props;
  const { length = SLIDER_DEFAULT_LENGTH, ticks = SLIDER_DEFAULT_TICKS, fill = false, meter, disabled } = props;
  const hasStrips = fill || meter !== undefined;
  return (
    <BaseSlider.Root
      className={classNames('hw-Slider', props.className)}
      style={{ '--length': `${length}px`, '--turn': normalize(value, min, max) }}
      orientation={orientation}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === 'number') onValueChange(next);
      }}
    >
      <BaseSlider.Control className="hw-SliderControl">
        <BaseSlider.Track className="hw-SliderTrack">
          {tickPositions(ticks).map((tick) => (
            <span key={tick.at} className="hw-SliderTick" data-rank={tick.rank} style={{ '--at': tick.at }} />
          ))}
          <span className="hw-SliderSlot hw-Recess">
            {hasStrips && (
              <span className="hw-SliderStrips">
                {fill && <span className="hw-SliderStrip" data-kind="fill" />}
                {meter !== undefined && (
                  <span className="hw-SliderStrip" data-kind="meter" style={{ '--level': clamp(meter, 0, 1) }} />
                )}
              </span>
            )}
          </span>
          <BaseSlider.Thumb className="hw-SliderThumb" aria-label={props['aria-label']} />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}

type Tick = { at: number; rank: 'major' | 'minor' };

function tickPositions(count: number): readonly Tick[] {
  if (count < 2) return [];
  return Array.from({ length: count }, (_, index) => ({
    at: index / (count - 1),
    rank: index % MAJOR_TICK_INTERVAL === 0 ? 'major' : 'minor',
  }));
}

export { Slider };
export type { SliderOrientation, SliderProps };
