import { Text } from 'figma-kit';
import { useMemo, useRef, type PointerEvent } from 'react';
import {
  animationDuration,
  animationProgress,
  type Animation,
  type CubicBezier,
  type EasingAnimation,
  type SpringAnimation,
  type TimeAnimation,
} from '../animation';

type AnimationCurveProps = {
  value: Animation;
  onValueChange(value: Animation): void;
};

type EasingGraphProps = { value: EasingAnimation; onValueChange(value: EasingAnimation): void };

type Handle = 'start' | 'end';

type Range = { minimum: number; maximum: number };

type Plot = { x: Range; y: Range; inset: number };

type Point = { x: number; y: number };

type Grab = { handle: Handle; from: Point; pointer: Point; unit: number };

const WIDTH = 256;
const HEIGHT = 128;
const INSET = 12;
const SPRING_WINDOW_MS = 2000;
const SPRING_WINDOW_STEPS = 2 * (WIDTH - 2 * INSET);
const SPRING_HEADROOM = 0.1;
const UNIT: Range = { minimum: 0, maximum: 1 };
const HANDLE_HEIGHTS: Range = { minimum: -1, maximum: 2 };
const HANDLE_RADIUS = 5;
const BEZIER_DECIMALS = 2;
const LONG_DURATION_MS = 10_000;

export function AnimationCurve({ value, onValueChange }: AnimationCurveProps) {
  return (
    <div className="tuner-AnimationCurve">
      {value.type === 'easing' ? (
        <EasingGraph value={value} onValueChange={onValueChange} />
      ) : (
        <SpringGraph value={value} />
      )}
      <Text className="tuner-AnimationCurveCaption" size="2" color="tertiary">
        {curveCaption(value)}
      </Text>
    </div>
  );
}

function EasingGraph({ value, onValueChange }: EasingGraphProps) {
  const grab = useRef<Grab | null>(null);
  const plot = easingPlot(value.bezier);
  const origin = toCanvas({ x: 0, y: 0 }, plot);
  const end = toCanvas({ x: 1, y: 1 }, plot);
  const start = toCanvas(handlePoint(value.bezier, 'start'), plot);
  const finish = toCanvas(handlePoint(value.bezier, 'end'), plot);
  const grabHandle = (handle: Handle, event: PointerEvent<SVGCircleElement>) => {
    const graph = event.currentTarget.ownerSVGElement;
    if (graph === null) return;
    graph.setPointerCapture(event.pointerId);
    grab.current = {
      handle,
      from: handlePoint(value.bezier, handle),
      pointer: pointerOnCanvas(event, graph),
      unit: easingUnit(value.bezier),
    };
  };
  const moveHandle = (event: PointerEvent<SVGSVGElement>) => {
    if (grab.current === null) return;
    const point = draggedHandle(grab.current, pointerOnCanvas(event, event.currentTarget));
    onValueChange({ ...value, bezier: movedBezier(value.bezier, grab.current.handle, point) });
  };
  return (
    <svg
      className="tuner-AnimationCurveGraph"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden
      onPointerMove={moveHandle}
      onLostPointerCapture={() => {
        grab.current = null;
      }}
    >
      <Levels plot={plot} />
      <line className="tuner-AnimationCurveArm" x1={origin.x} y1={origin.y} x2={start.x} y2={start.y} />
      <line className="tuner-AnimationCurveArm" x1={end.x} y1={end.y} x2={finish.x} y2={finish.y} />
      <path
        className="tuner-AnimationCurveLine"
        d={`M${origin.x} ${origin.y} C${start.x} ${start.y} ${finish.x} ${finish.y} ${end.x} ${end.y}`}
      />
      <circle
        className="tuner-AnimationCurveHandle"
        cx={start.x}
        cy={start.y}
        r={HANDLE_RADIUS}
        onPointerDown={(event) => grabHandle('start', event)}
      />
      <circle
        className="tuner-AnimationCurveHandle"
        cx={finish.x}
        cy={finish.y}
        r={HANDLE_RADIUS}
        onPointerDown={(event) => grabHandle('end', event)}
      />
    </svg>
  );
}

function SpringGraph({ value }: { value: SpringAnimation | TimeAnimation }) {
  const samples = useMemo(() => springWindow(value), [value]);
  const plot = springPlot(samples);
  return (
    <svg className="tuner-AnimationCurveGraph" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden>
      <Levels plot={plot} />
      <path className="tuner-AnimationCurveLine" d={samplesPath(samples, plot)} />
    </svg>
  );
}

function Levels({ plot }: { plot: Plot }) {
  const target = toCanvas({ x: 0, y: 1 }, plot).y;
  const base = toCanvas({ x: 0, y: 0 }, plot).y;
  return (
    <>
      <line className="tuner-AnimationCurveTarget" x1={INSET} x2={WIDTH - INSET} y1={target} y2={target} />
      <line className="tuner-AnimationCurveBase" x1={INSET} x2={WIDTH - INSET} y1={base} y2={base} />
    </>
  );
}

function springWindow(animation: Animation): number[] {
  return Array.from({ length: SPRING_WINDOW_STEPS + 1 }, (_, step) =>
    animationProgress(animation, (step / SPRING_WINDOW_STEPS) * SPRING_WINDOW_MS)
  );
}

function springPlot(samples: readonly number[]): Plot {
  const lowest = samples.reduce((low, sample) => Math.min(low, sample), 0);
  const highest = samples.reduce((high, sample) => Math.max(high, sample), 1);
  return { x: UNIT, y: { minimum: lowest - SPRING_HEADROOM, maximum: highest + SPRING_HEADROOM }, inset: INSET };
}

function samplesPath(samples: readonly number[], plot: Plot): string {
  const last = Math.max(samples.length - 1, 1);
  return samples
    .map((progress, index) => {
      const point = toCanvas({ x: index / last, y: progress }, plot);
      return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(' ');
}

function easingPlot(bezier: CubicBezier): Plot {
  const unit = easingUnit(bezier);
  return { x: aroundCenter(WIDTH / unit), y: aroundCenter(HEIGHT / unit), inset: 0 };
}

function easingUnit([, y1, , y2]: CubicBezier): number {
  const reach = Math.max(0.5, Math.abs(y1 - 0.5), Math.abs(y2 - 0.5));
  return Math.min(WIDTH - 2 * INSET, (HEIGHT / 2 - INSET) / reach);
}

function aroundCenter(span: number): Range {
  return { minimum: 0.5 - span / 2, maximum: 0.5 + span / 2 };
}

function toCanvas({ x, y }: Point, plot: Plot): Point {
  return {
    x: plot.inset + fraction(x, plot.x) * (WIDTH - 2 * plot.inset),
    y: HEIGHT - plot.inset - fraction(y, plot.y) * (HEIGHT - 2 * plot.inset),
  };
}

function draggedHandle({ from, pointer, unit }: Grab, movedPointer: Point): Point {
  return {
    x: clamp(from.x + (movedPointer.x - pointer.x) / unit, UNIT.minimum, UNIT.maximum),
    y: clamp(from.y - (movedPointer.y - pointer.y) / unit, HANDLE_HEIGHTS.minimum, HANDLE_HEIGHTS.maximum),
  };
}

function pointerOnCanvas(event: PointerEvent, graph: SVGSVGElement): Point {
  const box = graph.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * WIDTH,
    y: ((event.clientY - box.top) / box.height) * HEIGHT,
  };
}

function handlePoint([x1, y1, x2, y2]: CubicBezier, handle: Handle): Point {
  return handle === 'start' ? { x: x1, y: y1 } : { x: x2, y: y2 };
}

function movedBezier([x1, y1, x2, y2]: CubicBezier, handle: Handle, point: Point): CubicBezier {
  const x = round(point.x);
  const y = round(point.y);
  return handle === 'start' ? [x, y, x2, y2] : [x1, y1, x, y];
}

function curveCaption(animation: Animation): string {
  const duration = formatDuration(animationDuration(animation));
  return animation.type === 'easing' ? duration : `${duration} settle`;
}

function formatDuration(ms: number): string {
  return ms < LONG_DURATION_MS ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fraction(value: number, { minimum, maximum }: Range): number {
  return (value - minimum) / (maximum - minimum);
}

function round(value: number): number {
  return Number(value.toFixed(BEZIER_DECIMALS));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
