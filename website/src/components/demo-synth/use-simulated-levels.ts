import { useEffect, useRef, useState } from 'react';
import { tunable } from '@/lib/tuner/tunable';

const LEVEL_ATTACK = tunable('demo.levelAttack', 0.5);
const LEVEL_RELEASE = tunable('demo.levelRelease', 0.08);
const LEVEL_RESOLUTION = 64;
const FRAME_INTERVAL_MS = 33;
const SILENT: Levels = [0, 0];
const CHANNEL_RATES: readonly (readonly [number, number, number])[] = [
  [0.0021, 0.0057, 0.0113],
  [0.0026, 0.0049, 0.0131],
];

type Levels = readonly [left: number, right: number];

type Signal = { gain: number; active: boolean };

function useSimulatedLevels({ gain, active }: Signal): Levels {
  const [levels, setLevels] = useState<Levels>(SILENT);
  const smoothed = useRef<Levels>(SILENT);
  const running = active || isAudible(levels);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let lastTick = 0;
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (time - lastTick < FRAME_INTERVAL_MS) return;
      lastTick = time;
      const drive = active ? gain : 0;
      const [left, right] = smoothed.current;
      smoothed.current = [follow(left, drive * wobble(time, 0)), follow(right, drive * wobble(time, 1))];
      const next: Levels = [quantize(smoothed.current[0]), quantize(smoothed.current[1])];
      setLevels((previous) => (sameLevels(previous, next) ? previous : next));
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, gain, active]);

  return levels;
}

function isAudible(levels: Levels): boolean {
  return levels[0] > 0 || levels[1] > 0;
}

function wobble(time: number, channel: number): number {
  const [slow, medium, fast] = CHANNEL_RATES[channel] ?? CHANNEL_RATES[0];
  const swell = 0.5 + 0.5 * Math.sin(time * slow + channel);
  const pulse = 0.5 + 0.5 * Math.sin(time * medium + channel * 2.1);
  const flutter = 0.5 + 0.5 * Math.sin(time * fast);
  return 0.45 + 0.25 * swell + 0.2 * pulse + 0.1 * flutter * Math.random();
}

function follow(current: number, target: number): number {
  const rate = target > current ? LEVEL_ATTACK : LEVEL_RELEASE;
  return current + (target - current) * rate;
}

function quantize(level: number): number {
  return Math.round(level * LEVEL_RESOLUTION) / LEVEL_RESOLUTION;
}

function sameLevels(a: Levels, b: Levels): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export { useSimulatedLevels };
export type { Levels };
