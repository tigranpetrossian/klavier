'use client';

import { Meter as BaseMeter } from '@base-ui/react/meter';
import { classNames } from './class-names';
import { clamp } from './number-range';
import { tunable } from '@/lib/tuner/tunable';
import './lighting.css';
import './surface.css';
import './recess.css';
import './screen.css';
import './meter.css';

const METER_SEGMENTS = tunable('meter.segments', 16);
const METER_PEAK_SEGMENTS = tunable('meter.peakSegments', 3);

type MeterProps = {
  levels: readonly number[];
  'aria-label': string;
  segments?: number;
  peakSegments?: number;
  className?: string;
};

function Meter(props: MeterProps) {
  const { levels, segments = METER_SEGMENTS, peakSegments = METER_PEAK_SEGMENTS } = props;
  return (
    <BaseMeter.Root
      className={classNames('hw-Meter', props.className)}
      aria-label={props['aria-label']}
      min={0}
      max={1}
      value={loudest(levels)}
    >
      <BaseMeter.Track className="hw-Screen hw-Recess hw-MeterWindow">
        <span className="hw-ScreenGlass">
          <span className="hw-MeterColumns">
            {levels.map((level, channel) => (
              <span key={channel} className="hw-MeterColumn">
                {segmentStates(level, segments, peakSegments).map((segment, index) => (
                  <span
                    key={index}
                    className="hw-MeterSegment"
                    data-lit={segment.lit ? '' : undefined}
                    data-zone={segment.peak ? 'peak' : 'signal'}
                  />
                ))}
              </span>
            ))}
          </span>
        </span>
      </BaseMeter.Track>
    </BaseMeter.Root>
  );
}

type SegmentState = { lit: boolean; peak: boolean };

function segmentStates(level: number, segments: number, peakSegments: number): readonly SegmentState[] {
  const count = Math.max(1, Math.round(segments));
  const litCount = Math.round(clamp(level, 0, 1) * count);
  return Array.from({ length: count }, (_, index) => ({
    lit: index < litCount,
    peak: index >= count - peakSegments,
  }));
}

function loudest(levels: readonly number[]): number {
  return clamp(Math.max(0, ...levels), 0, 1);
}

export { Meter };
export type { MeterProps };
