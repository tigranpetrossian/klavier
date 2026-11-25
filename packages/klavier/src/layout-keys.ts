const DEFAULT_RANGE: readonly [number, number] = [21, 108];
const DEFAULT_BLACK_KEY_LENGTH = 0.65;
const LOWEST_NOTE = 0;
const HIGHEST_NOTE = 127;
const NOTES_PER_OCTAVE = 12;
const WHITE_KEYS_PER_OCTAVE = 7;
const WHITE_KEY_ASPECT_RATIO = 23.5 / 150;
const BLACK_KEY_WIDTH_IN_WHITE_KEYS = 7 / 12;
const BLACK_KEY_SHARE_LEFT_OF_BOUNDARY: Readonly<Record<number, number>> = {
  1: 2 / 3,
  3: 1 / 3,
  6: 3 / 4,
  8: 1 / 2,
  10: 1 / 4,
};
const WHITE_KEYS_BELOW_PITCH_CLASS = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const TIE_TOLERANCE = 1e-6;

interface LayoutInput {
  width: number;
  height: number;
  range?: readonly [first: number, last: number] | undefined;
  pixelRatio?: number | undefined;
  blackKeyLength?: number | undefined;
}

interface KeyRect {
  note: number;
  black: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface KlavierLayout {
  width: number;
  height: number;
  pixelRatio: number;
  range: readonly [first: number, last: number];
  keys: readonly KeyRect[];
}

interface Span {
  left: number;
  right: number;
}

function layoutKeys(input: LayoutInput): KlavierLayout {
  const range = normalizeRange(input.range);
  const [first, last] = range;
  const width = positiveOrZero(input.width);
  const height = positiveOrZero(input.height);
  const pixelRatio = normalizePixelRatio(input.pixelRatio);
  const blackKeyLength = normalizeBlackKeyLength(input.blackKeyLength);

  const origin = spanInWhiteKeys(first).left;
  const deviceWidth = positiveOrZero(Math.round(width * pixelRatio));
  const whiteWidth = deviceWidth / (spanInWhiteKeys(last).right - origin);
  const blackWidth = Math.round(whiteWidth * BLACK_KEY_WIDTH_IN_WHITE_KEYS);
  const blackHeight = positiveOrZero(Math.round(height * pixelRatio * blackKeyLength));
  const lastBlackLeft = Math.max(0, deviceWidth - blackWidth);
  const toCssPixels = (devicePixels: number): number => positiveOrZero(devicePixels / pixelRatio);

  const keys = Array.from({ length: last - first + 1 }, (unused, index): KeyRect => {
    const note = first + index;
    const span = spanInWhiteKeys(note);
    const left = snap((span.left - origin) * whiteWidth);

    if (isBlackKey(note)) {
      return {
        note,
        black: true,
        x: toCssPixels(note === last ? lastBlackLeft : Math.min(left, lastBlackLeft)),
        y: 0,
        width: toCssPixels(blackWidth),
        height: toCssPixels(blackHeight),
      };
    }

    const right = snap((span.right - origin) * whiteWidth);
    return { note, black: false, x: toCssPixels(left), y: 0, width: toCssPixels(right - left), height };
  });

  return { width, height, pixelRatio, range, keys };
}

function naturalAspectRatio(range: readonly [number, number] | undefined): number {
  const [first, last] = normalizeRange(range);
  return (spanInWhiteKeys(last).right - spanInWhiteKeys(first).left) * WHITE_KEY_ASPECT_RATIO;
}

function normalizeRange(range: readonly [number, number] | undefined): readonly [number, number] {
  if (!range || !Number.isFinite(range[0]) || !Number.isFinite(range[1])) return DEFAULT_RANGE;
  const first = clampNote(Math.min(range[0], range[1]));
  const last = clampNote(Math.max(range[0], range[1]));
  return [first, last];
}

function isBlackKey(note: number): boolean {
  return note % NOTES_PER_OCTAVE in BLACK_KEY_SHARE_LEFT_OF_BOUNDARY;
}

function spanInWhiteKeys(note: number): Span {
  const pitchClass = note % NOTES_PER_OCTAVE;
  const white =
    Math.floor(note / NOTES_PER_OCTAVE) * WHITE_KEYS_PER_OCTAVE + (WHITE_KEYS_BELOW_PITCH_CLASS[pitchClass] ?? 0);
  const shareLeftOfBoundary = BLACK_KEY_SHARE_LEFT_OF_BOUNDARY[pitchClass];

  if (shareLeftOfBoundary === undefined) return { left: white, right: white + 1 };

  const left = white + 1 - shareLeftOfBoundary * BLACK_KEY_WIDTH_IN_WHITE_KEYS;
  return { left, right: left + BLACK_KEY_WIDTH_IN_WHITE_KEYS };
}

// Edges that fall exactly between two device pixels must all round the same way, or float noise makes neighbouring
// keys differ by two pixels.
function snap(devicePixels: number): number {
  return Math.floor(devicePixels + 0.5 - TIE_TOLERANCE);
}

function clampNote(note: number): number {
  return Math.min(HIGHEST_NOTE, Math.max(LOWEST_NOTE, Math.round(note)));
}

function positiveOrZero(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizePixelRatio(pixelRatio: number | undefined): number {
  return pixelRatio !== undefined && Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
}

function normalizeBlackKeyLength(blackKeyLength: number | undefined): number {
  if (blackKeyLength === undefined || !Number.isFinite(blackKeyLength)) return DEFAULT_BLACK_KEY_LENGTH;
  return Math.min(1, Math.max(0, blackKeyLength));
}

export { layoutKeys, naturalAspectRatio, normalizeRange, isBlackKey, DEFAULT_RANGE, DEFAULT_BLACK_KEY_LENGTH };
export type { LayoutInput, KeyRect, KlavierLayout };
