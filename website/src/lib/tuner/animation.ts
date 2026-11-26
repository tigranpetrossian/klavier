export type SpringAnimation = { type: 'spring'; stiffness: number; damping: number; mass: number; delay: number };
export type TimeAnimation = { type: 'time'; duration: number; bounce: number; delay: number };
export type CubicBezier = [x1: number, y1: number, x2: number, y2: number];
export type EasingAnimation = { type: 'easing'; duration: number; bezier: CubicBezier; delay: number };
export type Animation = SpringAnimation | TimeAnimation | EasingAnimation;
export type AnimationType = Animation['type'];

type Spring = { stiffness: number; damping: number; mass: number };

type Oscillator = { naturalFrequency: number; dampingRatio: number };

type Offset = (seconds: number) => number;

type Curve = { duration: number; oscillations: number; progressAt(ms: number): number };

const REST_DISTANCE = 0.005;
const SETTLE_SOLVER_STEPS = 48;
const SAMPLES_PER_OSCILLATION = 16;
const MAX_OSCILLATION_SAMPLES = 4096;
const STILL: Curve = { duration: 0, oscillations: 0, progressAt: () => 1 };
const MOTION_PERIODS_PER_DURATION = 1.2;
const MIN_DAMPING_RATIO = 0.05;
const MAX_DAMPING_RATIO = 1;
const CRITICAL_DAMPING_TOLERANCE = 1e-6;
const DEFAULT_BEZIER: CubicBezier = [0.25, 0.1, 0.25, 1];
const LINEAR_FRAME_MS = 16;
const MIN_LINEAR_POINTS = 12;
const MAX_LINEAR_POINTS = 120;
const LINEAR_DECIMALS = 4;
const SUMMARY_DECIMALS = 2;
const BEZIER_SOLVER_STEPS = 24;
const ANIMATION_TYPES: ReadonlySet<unknown> = new Set(['spring', 'time', 'easing']);

export function isAnimation(value: unknown): value is Animation {
  if (!isRecord(value) || !ANIMATION_TYPES.has(value.type) || !isFiniteNumber(value.delay)) return false;
  switch (value.type) {
    case 'spring':
      return hasExactKeys(value, 5) && [value.stiffness, value.damping, value.mass].every(isFiniteNumber);
    case 'time':
      return hasExactKeys(value, 4) && isFiniteNumber(value.duration) && isFiniteNumber(value.bounce);
    default:
      return hasExactKeys(value, 4) && isFiniteNumber(value.duration) && isCubicBezier(value.bezier);
  }
}

export function summarizeAnimation(animation: Animation): string {
  const delay = animation.delay > 0 ? ` · ${Math.round(animation.delay)}ms delay` : '';
  switch (animation.type) {
    case 'spring':
      return `Spring · ${[animation.stiffness, animation.damping, animation.mass].map(summaryNumber).join(' | ')}${delay}`;
    case 'time':
      return `Duration · ${Math.round(animation.duration)}ms | ${summaryNumber(animation.bounce)}${delay}`;
    case 'easing':
      return `Ease · ${compactBezier(animation.bezier)}${delay}`;
  }
}

export function animationDuration(animation: Animation): number {
  return curveOf(animation).duration;
}

export function animationProgress(animation: Animation, ms: number): number {
  const { duration, progressAt } = curveOf(animation);
  if (ms >= duration) return 1;
  return ms <= 0 ? 0 : progressAt(ms);
}

export function animationEasing(animation: Animation): string {
  if (animation.type === 'easing') return `cubic-bezier(${animation.bezier.join(', ')})`;
  const points = sampleAnimation(animation, linearPointCount(animationDuration(animation)));
  return `linear(${points.map((point) => decimal(point, LINEAR_DECIMALS)).join(', ')})`;
}

export function animationTransition(animation: Animation, property = 'all'): string {
  const duration = Math.round(animationDuration(animation));
  return `${property} ${duration}ms ${animationEasing(animation)} ${Math.round(animation.delay)}ms`;
}

export function sampleAnimation(animation: Animation, count: number): number[] {
  const { duration, oscillations, progressAt } = curveOf(animation);
  const steps = Math.max(1, Math.round(count) - 1, oscillationSteps(oscillations));
  return Array.from({ length: steps + 1 }, (_, step) => (step === steps ? 1 : progressAt((step / steps) * duration)));
}

export function convertAnimation(animation: Animation, type: AnimationType): Animation {
  if (animation.type === type) return animation;
  const { delay } = animation;
  switch (type) {
    case 'spring':
      return { type, ...springOf(animation), delay };
    case 'time':
      return { type, ...timeOf(animation), delay };
    case 'easing':
      return { type, duration: Math.round(perceivedDuration(animation)), bezier: DEFAULT_BEZIER, delay };
  }
}

function springOf(animation: Animation): Spring {
  switch (animation.type) {
    case 'spring':
      return { stiffness: animation.stiffness, damping: animation.damping, mass: animation.mass };
    case 'time':
      return springFromTime(animation.duration, animation.bounce);
    case 'easing':
      return springFromTime(animation.duration, 0);
  }
}

function springFromTime(duration: number, bounce: number): Spring {
  const period = (Math.max(duration, 1) / 1000) * MOTION_PERIODS_PER_DURATION;
  const stiffness = ((2 * Math.PI) / period) ** 2;
  const dampingRatio = clamp(1 - bounce, MIN_DAMPING_RATIO, MAX_DAMPING_RATIO);
  return { stiffness: round(stiffness), damping: round(2 * dampingRatio * Math.sqrt(stiffness)), mass: 1 };
}

function timeOf(animation: Animation): { duration: number; bounce: number } {
  if (animation.type !== 'spring') return { duration: Math.round(animation.duration), bounce: 0 };
  return {
    duration: Math.round(perceivedDuration(animation)),
    bounce: round(1 - clamp(dampingRatio(springOf(animation)), 0, 1)),
  };
}

function perceivedDuration(animation: Animation): number {
  if (animation.type !== 'spring') return animation.duration;
  const { stiffness, mass } = springOf(animation);
  const period = (2 * Math.PI) / Math.sqrt(stiffness / mass);
  return (period / MOTION_PERIODS_PER_DURATION) * 1000;
}

function dampingRatio({ stiffness, damping, mass }: Spring): number {
  return damping / (2 * Math.sqrt(stiffness * mass));
}

function curveOf(animation: Animation): Curve {
  if (animation.type !== 'easing') return springCurve(springOf(animation));
  const { duration, bezier } = animation;
  return { duration, oscillations: 0, progressAt: bezierProgress(bezier, duration) };
}

function springCurve(spring: Spring): Curve {
  const oscillator = oscillatorOf(spring);
  if (oscillator === null) return STILL;
  const offset = offsetOf(oscillator);
  const settle = settleSeconds(oscillator, offset);
  return {
    duration: settle * 1000,
    oscillations: (settle * dampedFrequency(oscillator)) / (2 * Math.PI),
    progressAt: (ms) => 1 + offset(ms / 1000),
  };
}

function oscillatorOf(spring: Spring): Oscillator | null {
  const { stiffness, damping, mass } = spring;
  const oscillator = { naturalFrequency: Math.sqrt(stiffness / mass), dampingRatio: dampingRatio(spring) };
  const settles = [stiffness, damping, mass, oscillator.naturalFrequency, oscillator.dampingRatio].every(isPositive);
  return settles ? oscillator : null;
}

function dampedFrequency({ naturalFrequency, dampingRatio }: Oscillator): number {
  const oscillates = dampingRatio <= 1 - CRITICAL_DAMPING_TOLERANCE;
  return oscillates ? naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio) : 0;
}

function offsetOf(oscillator: Oscillator): Offset {
  const { naturalFrequency, dampingRatio } = oscillator;
  const frequency = dampedFrequency(oscillator);
  if (frequency > 0) {
    const decay = dampingRatio * naturalFrequency;
    return (t) => -Math.exp(-decay * t) * (Math.cos(frequency * t) + (decay / frequency) * Math.sin(frequency * t));
  }
  if (dampingRatio - 1 < CRITICAL_DAMPING_TOLERANCE)
    return (t) => -Math.exp(-naturalFrequency * t) * (1 + naturalFrequency * t);
  const fast = -naturalFrequency * (dampingRatio + Math.sqrt(dampingRatio * dampingRatio - 1));
  const slow = (naturalFrequency * naturalFrequency) / fast;
  return (t) => (fast * Math.exp(slow * t) - slow * Math.exp(fast * t)) / (slow - fast);
}

function settleSeconds(oscillator: Oscillator, offset: Offset): number {
  const moving = (seconds: number) => Math.abs(offset(seconds)) >= REST_DISTANCE;
  const frequency = dampedFrequency(oscillator);
  if (frequency === 0) return firstRest(moving, 0, laterRest(moving, 1 / oscillator.naturalFrequency));
  const halfPeriod = Math.PI / frequency;
  const lastTurn = lastTurnBeyondRest(oscillator, halfPeriod);
  return firstRest(moving, lastTurn, lastTurn + halfPeriod);
}

function lastTurnBeyondRest({ naturalFrequency, dampingRatio }: Oscillator, halfPeriod: number): number {
  const decayPerTurn = dampingRatio * naturalFrequency * halfPeriod;
  return Math.floor(-Math.log(REST_DISTANCE) / decayPerTurn) * halfPeriod;
}

function laterRest(moving: (seconds: number) => boolean, start: number): number {
  let seconds = start;
  while (moving(seconds)) seconds *= 2;
  return seconds;
}

function firstRest(moving: (seconds: number) => boolean, movingAt: number, restingAt: number): number {
  let low = movingAt;
  let high = restingAt;
  for (let step = 0; step < SETTLE_SOLVER_STEPS; step++) {
    const middle = (low + high) / 2;
    if (moving(middle)) low = middle;
    else high = middle;
  }
  return high;
}

function oscillationSteps(oscillations: number): number {
  return Math.min(Math.ceil(oscillations * SAMPLES_PER_OSCILLATION), MAX_OSCILLATION_SAMPLES);
}

function bezierProgress([x1, y1, x2, y2]: CubicBezier, duration: number): (ms: number) => number {
  const startX = clamp(x1, 0, 1);
  const endX = clamp(x2, 0, 1);
  return (ms) => {
    if (duration <= 0) return 1;
    const parameter = bezierParameterAt(clamp(ms / duration, 0, 1), startX, endX);
    return bezierCoordinate(parameter, y1, y2);
  };
}

function bezierParameterAt(x: number, x1: number, x2: number): number {
  let low = 0;
  let high = 1;
  for (let step = 0; step < BEZIER_SOLVER_STEPS; step++) {
    const middle = (low + high) / 2;
    if (bezierCoordinate(middle, x1, x2) < x) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function bezierCoordinate(parameter: number, first: number, second: number): number {
  const rest = 1 - parameter;
  return 3 * rest * rest * parameter * first + 3 * rest * parameter * parameter * second + parameter ** 3;
}

function linearPointCount(duration: number): number {
  return clamp(Math.ceil(duration / LINEAR_FRAME_MS) + 1, MIN_LINEAR_POINTS, MAX_LINEAR_POINTS);
}

function compactBezier(bezier: CubicBezier): string {
  return `cubic-bezier(${bezier.map((value) => summaryNumber(value).replace(/^(-?)0\./, '$1.')).join(',')})`;
}

function summaryNumber(value: number): string {
  return decimal(value, SUMMARY_DECIMALS);
}

function decimal(value: number, decimals: number): string {
  return String(Number(value.toFixed(decimals)));
}

function round(value: number): number {
  return Number(value.toFixed(SUMMARY_DECIMALS));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isCubicBezier(value: unknown): value is CubicBezier {
  return Array.isArray(value) && value.length === 4 && value.every(isFiniteNumber);
}

function hasExactKeys(value: Record<string, unknown>, count: number): boolean {
  return Object.keys(value).length === count;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}
