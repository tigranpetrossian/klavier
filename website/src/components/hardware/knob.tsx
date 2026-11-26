'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { classNames } from './class-names';
import { clamp, normalize, snapToStep } from './number-range';
import { tunable } from '@/lib/tuner/tunable';
import './lighting.css';
import './surface.css';
import './recess.css';
import './knob.css';

const KNOB_SWEEP_DEGREES = tunable('knob.sweepDegrees', 270);
const KNOB_DRAG_DISTANCE = tunable('knob.dragDistance', 180);
const KNOB_FINE_FACTOR = tunable('knob.fineFactor', 0.2);
const KNOB_DEFAULT_SIZE = 88;
const KNOB_DOT_COUNT = 11;
const FULL_TURN = 360;
const TOP_OF_CIRCLE = 270;
const DOT_DASH = 0.001;
const DOT_EPSILON = 1e-6;

type KnobScale = 'none' | 'arc' | 'dots' | 'lit-dots';

type KnobProps = {
  value: number;
  onValueChange(value: number): void;
  'aria-label': string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  size?: number;
  scale?: KnobScale;
  disabled?: boolean;
  className?: string;
};

type DragState = { x: number; y: number; raw: number };

function Knob(props: KnobProps) {
  const { value, onValueChange, min = 0, max = 1, step = 0.01, defaultValue } = props;
  const { size = KNOB_DEFAULT_SIZE, scale = 'none', disabled = false } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const turn = normalize(value, min, max);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    inputRef.current?.focus({ preventScroll: true });
    drag.current = { x: event.clientX, y: event.clientY, raw: value };
    setDragging(true);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const last = drag.current;
    if (last === null) return;
    const travel = dragTravel(last, event) * (event.shiftKey ? KNOB_FINE_FACTOR : 1);
    const raw = last.raw + travel * (max - min);
    drag.current = { x: event.clientX, y: event.clientY, raw: clamp(raw, min, max) };
    const next = snapToStep(raw, min, max, step);
    if (next !== value) onValueChange(next);
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const resetToDefault = () => {
    if (disabled || defaultValue === undefined || defaultValue === value) return;
    onValueChange(defaultValue);
  };

  return (
    <div
      className={classNames('hw-Knob hw-Recess', props.className)}
      data-dragging={dragging ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      style={{
        '--size': `${size}px`,
        '--angle': `${pointerAngle(turn)}deg`,
        '--scale-start': `${scaleStart()}deg`,
      }}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={resetToDefault}
    >
      {scale === 'arc' && <ArcScale turn={turn} />}
      {scale === 'dots' && <DotScale turn={turn} lit={false} />}
      {scale === 'lit-dots' && <DotScale turn={turn} lit />}
      <div className="hw-KnobPointer" />
      <input
        ref={inputRef}
        className="hw-KnobInput"
        type="range"
        aria-label={props['aria-label']}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.valueAsNumber)}
      />
    </div>
  );
}

function ArcScale({ turn }: { turn: number }) {
  const track = `${KNOB_SWEEP_DEGREES} ${FULL_TURN}`;
  return (
    <svg className="hw-KnobScale hw-Recess" data-kind="arc" aria-hidden>
      <circle className="hw-KnobScaleEdge" data-side="near" pathLength={FULL_TURN} strokeDasharray={track} />
      <circle className="hw-KnobScaleEdge" data-side="far" pathLength={FULL_TURN} strokeDasharray={track} />
      <circle className="hw-KnobScaleTrack" pathLength={FULL_TURN} strokeDasharray={track} />
      <circle
        className="hw-KnobScaleLit"
        pathLength={FULL_TURN}
        strokeDasharray={`${turn * KNOB_SWEEP_DEGREES} ${FULL_TURN}`}
      />
    </svg>
  );
}

function DotScale({ turn, lit }: { turn: number; lit: boolean }) {
  return (
    <svg className="hw-KnobScale" data-kind="dots" data-lit={lit ? '' : undefined} aria-hidden>
      <circle className="hw-KnobScaleMark" pathLength={FULL_TURN} strokeDasharray={dotDashes(KNOB_DOT_COUNT)} />
      {lit && (
        <circle className="hw-KnobScaleLit" pathLength={FULL_TURN} strokeDasharray={dotDashes(litDotCount(turn))} />
      )}
    </svg>
  );
}

function dragTravel(last: DragState, event: PointerEvent): number {
  return (last.y - event.clientY + event.clientX - last.x) / KNOB_DRAG_DISTANCE;
}

function pointerAngle(turn: number): number {
  return (turn - 0.5) * KNOB_SWEEP_DEGREES;
}

function scaleStart(): number {
  return TOP_OF_CIRCLE - KNOB_SWEEP_DEGREES / 2;
}

function litDotCount(turn: number): number {
  return Math.floor(turn * (KNOB_DOT_COUNT - 1) + DOT_EPSILON) + 1;
}

function dotDashes(shown: number): string {
  const gap = KNOB_SWEEP_DEGREES / (KNOB_DOT_COUNT - 1) - DOT_DASH;
  const dots = Array.from({ length: shown }, (_, index) =>
    index === shown - 1 ? `${DOT_DASH} ${FULL_TURN}` : `${DOT_DASH} ${gap}`
  );
  return dots.join(' ');
}

export { Knob };
export type { KnobProps, KnobScale };
