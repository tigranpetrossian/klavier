import type { CSSProperties } from 'react';
import type { Frame, KlavierOptions, NoteOffEvent, NoteOnEvent, Painter } from '../klavier-types';
import type { KlavierLayout } from '../layout-keys';
import type { Point } from './real-input';

const TEST_RANGE: readonly [number, number] = [48, 72];
const HOST_STYLE: CSSProperties = { position: 'fixed', left: '40px', top: '40px', width: '720px', height: '160px' };

type NoteLogEntry = ({ type: 'noteon' } & NoteOnEvent) | ({ type: 'noteoff' } & NoteOffEvent);

interface Recording {
  log: NoteLogEntry[];
  layouts: KlavierLayout[];
  frames: Frame[];
  painter: Painter;
  onNoteOn: (event: NoteOnEvent) => void;
  onNoteOff: (event: NoteOffEvent) => void;
  onLayout: (layout: KlavierLayout) => void;
}

interface Mounted {
  host: HTMLElement;
  log: NoteLogEntry[];
  layouts: KlavierLayout[];
  frames: Frame[];
  layout(): KlavierLayout;
  update(patch: KlavierOptions): Promise<void>;
  focus(): void;
  unmount(): Promise<void>;
}

interface MountSettings {
  style?: CSSProperties;
  container?: HTMLElement;
}

type Mount = (options?: KlavierOptions, settings?: MountSettings) => Promise<Mounted>;

const stillMounted = new Set<Mounted>();

function createRecording(): Recording {
  const log: NoteLogEntry[] = [];
  const layouts: KlavierLayout[] = [];
  const frames: Frame[] = [];

  return {
    log,
    layouts,
    frames,
    painter: (ctx, frame) => {
      frames.push({ ...frame, keys: frame.keys.map((key) => ({ ...key })) });
    },
    onNoteOn: (event) => {
      log.push({ type: 'noteon', ...event });
    },
    onNoteOff: (event) => {
      log.push({ type: 'noteoff', ...event });
    },
    onLayout: (layout) => {
      layouts.push(layout);
    },
  };
}

function withTestDefaults(options: KlavierOptions | undefined, recording: Recording): KlavierOptions {
  return { range: TEST_RANGE, painter: recording.painter, ...options };
}

function trackMounted(mounted: Omit<Mounted, 'unmount'>, unmount: () => Promise<void>): Mounted {
  const tracked: Mounted = {
    ...mounted,
    unmount: async () => {
      if (stillMounted.delete(tracked)) await unmount();
    },
  };
  stillMounted.add(tracked);
  return tracked;
}

async function nextFrame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function unmountEverything(): Promise<void> {
  for (const mounted of [...stillMounted]) await mounted.unmount();
  document.body.replaceChildren();
}

function pointOnKey(mounted: Mounted, note: number, at: Point = { x: 0.5, y: 0.85 }): Point {
  const key = mounted.layout().keys.find((candidate) => candidate.note === note);
  if (!key) throw new Error(`note ${note} is not on the mounted keyboard`);

  const rect = keysRect(mounted);
  return { x: rect.left + key.x + key.width * at.x, y: rect.top + key.y + key.height * at.y };
}

function keysRect(mounted: Mounted): DOMRect {
  const canvas = mounted.host.querySelector('canvas');
  if (!canvas) throw new Error('the mounted keyboard has no canvas');
  return canvas.getBoundingClientRect();
}

function soundingNotes(log: readonly NoteLogEntry[]): number[] {
  const sounding = new Set<number>();
  for (const entry of log) {
    if (entry.type === 'noteon') sounding.add(entry.note);
    else sounding.delete(entry.note);
  }
  return [...sounding].sort((a, b) => a - b);
}

function pressedButtonNotes(mounted: Mounted): number[] {
  return [...mounted.host.querySelectorAll('button[aria-pressed="true"]')]
    .map((button) => Number(button.getAttribute('data-note')))
    .sort((a, b) => a - b);
}

function keyButton(mounted: Mounted, note: number): HTMLButtonElement | null {
  return mounted.host.querySelector<HTMLButtonElement>(`button[data-note="${note}"]`);
}

function lastFrame(mounted: Mounted): Frame | undefined {
  return mounted.frames.at(-1);
}

function paintedPressedNotes(mounted: Mounted): number[] {
  return (lastFrame(mounted)?.keys ?? []).filter((key) => key.pressed).map((key) => key.note);
}

export {
  TEST_RANGE,
  HOST_STYLE,
  createRecording,
  withTestDefaults,
  trackMounted,
  nextFrame,
  unmountEverything,
  pointOnKey,
  keysRect,
  soundingNotes,
  pressedButtonNotes,
  keyButton,
  lastFrame,
  paintedPressedNotes,
};
export type { Mounted, Mount, MountSettings, NoteLogEntry, Recording };
