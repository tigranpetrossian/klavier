import type { KeyView, Painter } from './klavier-types';

type Stops = ReadonlyArray<readonly [offset: number, color: string]>;

const GAP_COLOR = '#111';
const TINT_OPACITY = 0.6;
const TRANSPARENT = 'rgba(0,0,0,0)';

const WHITE_CORNER_RADIUS = 0.085;
const WHITE_BODY: Stops = [
  [0, '#ebebeb'],
  [1, '#f2f2f2'],
];
const WHITE_BODY_PRESSED: Stops = [
  [0, '#d9d9d9'],
  [1, '#d6d6d6'],
];
const WHITE_EDGES: Stops = [
  [0, 'rgba(24,24,24,0.04)'],
  [0.018, 'rgba(208,208,208,0.28)'],
  [0.034, 'rgba(255,255,255,0.5)'],
  [0.055, 'rgba(255,255,255,0.19)'],
  [0.957, 'rgba(255,255,255,0)'],
  [1, 'rgba(51,51,51,0.3)'],
];
const WHITE_EDGES_PRESSED: Stops = [
  [0, 'rgba(255,255,255,0)'],
  [0.034, 'rgba(255,255,255,0.33)'],
  [0.035, 'rgba(255,255,255,0.19)'],
  [0.076, 'rgba(255,255,255,0)'],
  [0.957, 'rgba(255,255,255,0)'],
  [1, 'rgba(51,51,51,0.3)'],
];
const SHADOW_OF_RAISED_NEIGHBOUR: Stops = [
  [0, 'rgba(0,0,0,0.5)'],
  [0.04, 'rgba(0,0,0,0.3)'],
  [0.13, 'rgba(0,0,0,0.18)'],
  [0.3, 'rgba(0,0,0,0.06)'],
  [0.45, 'rgba(0,0,0,0)'],
  [1, 'rgba(0,0,0,0)'],
];
const SHADOW_OF_FALLBOARD: Stops = [
  [0, 'rgba(0,0,0,0.25)'],
  [1, 'rgba(0,0,0,0)'],
];
const SHADOW_OF_FALLBOARD_REACH = 0.6;

const BLACK_BASE = '#000';
const BLACK_FRONT = '#242424';
const BLACK_CORNER_RADIUS = 0.05;
const BLACK_BOTTOM_MARGIN = 0.06;
const BLACK_LIP = 0.7;
const BLACK_LIP_PRESSED = 0.38;
const BLACK_LIP_MAX_SHARE_OF_LENGTH = 0.3;
const BLACK_LIP_GAP = 0.02;
const BLACK_LIP_INSET = 0.066;
const BLACK_LIP_RADII = [0.28, 0.28, 0.04, 0.04];
const BLACK_FACE_INSET = 0.145;
const BLACK_FACE_RADIUS = 0.25;
const BLACK_SIDE_INSET = 0.08;
const BLACK_SIDE_WIDTH = 0.053;
const BLACK_GLINT_RADIUS = 0.24;
const BLACK_GLINT_CENTRE = 0.27;
const BLACK_FACE: Stops = [
  [0, '#2b2b2b'],
  [0.17, '#333'],
  [0.48, '#474748'],
  [0.77, '#4f4f4f'],
  [1, '#3d3d3d'],
];
const BLACK_FACE_PRESSED: Stops = [
  [0, '#1f1f1f'],
  [0.77, '#383838'],
  [1, '#242424'],
];
const BLACK_LIP_FACE: Stops = [
  [0, '#070707'],
  [0.82, '#3b3b3b'],
  [1, '#464646'],
];
const BLACK_LEFT_SIDE: Stops = [
  [0, '#000'],
  [1, '#595959'],
];
const BLACK_RIGHT_SIDE: Stops = [
  [0, '#4d4c4c'],
  [1, '#000'],
];
const BLACK_GLINT: Stops = [
  [0, 'rgba(255,255,255,0.55)'],
  [1, 'rgba(255,255,255,0)'],
];

const paintDefaultKeys: Painter = (ctx, frame) => {
  const whites = frame.keys.filter((key) => !key.black);
  const gap = Math.max(1, Math.round(frame.pixelRatio / 2)) / frame.pixelRatio;

  whites.forEach((key, index) => {
    paintWhiteKey(ctx, key, gap, whites[index - 1]?.pressed ?? false);
  });
  for (const key of frame.keys) {
    if (key.black) paintBlackKey(ctx, key);
  }
};

function paintWhiteKey(ctx: CanvasRenderingContext2D, key: KeyView, gap: number, lowerNeighbourPressed: boolean): void {
  const left = key.x + gap;
  const width = key.width - gap;
  const bottom = key.y + key.height;
  if (width <= 0 || key.height <= 0) return;

  ctx.fillStyle = GAP_COLOR;
  ctx.fillRect(key.x, key.y, key.width, key.height);

  const radius = width * WHITE_CORNER_RADIUS;
  ctx.beginPath();
  ctx.roundRect(left, key.y, width, key.height, [0, 0, radius, radius]);

  ctx.fillStyle = gradient(ctx, left, key.y, left, bottom, key.pressed ? WHITE_BODY_PRESSED : WHITE_BODY);
  ctx.fill();
  tint(ctx, key.highlight);
  ctx.fillStyle = gradient(ctx, left, key.y, left + width, key.y, key.pressed ? WHITE_EDGES_PRESSED : WHITE_EDGES);
  ctx.fill();

  if (!key.pressed || lowerNeighbourPressed) return;

  ctx.fillStyle = gradient(ctx, left, key.y, left + width, key.y, SHADOW_OF_RAISED_NEIGHBOUR);
  ctx.fill();
  ctx.fillStyle = gradient(ctx, left, key.y, left, key.y + width * SHADOW_OF_FALLBOARD_REACH, SHADOW_OF_FALLBOARD);
  ctx.fill();
}

function paintBlackKey(ctx: CanvasRenderingContext2D, key: KeyView): void {
  const { x, y, width, height } = key;
  if (width <= 0 || height <= 0) return;

  const bottom = y + height - width * BLACK_BOTTOM_MARGIN;
  const lip = Math.min(width * (key.pressed ? BLACK_LIP_PRESSED : BLACK_LIP), height * BLACK_LIP_MAX_SHARE_OF_LENGTH);
  const lipTop = bottom - lip;
  const faceBottom = lipTop - width * BLACK_LIP_GAP;
  const faceRadius = width * BLACK_FACE_RADIUS;
  const sideLeft = x + width * BLACK_SIDE_INSET;
  const sideRight = x + width * (1 - BLACK_SIDE_INSET);
  const sideWidth = width * BLACK_SIDE_WIDTH;
  const cornerRadius = width * BLACK_CORNER_RADIUS;

  ctx.fillStyle = BLACK_BASE;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, [0, 0, cornerRadius, cornerRadius]);
  ctx.fill();

  ctx.fillStyle = BLACK_FRONT;
  ctx.fillRect(sideLeft, faceBottom - faceRadius, sideRight - sideLeft, bottom - faceBottom + faceRadius);

  ctx.fillStyle = gradient(ctx, sideLeft, y, sideLeft + sideWidth, y, BLACK_LEFT_SIDE);
  ctx.fillRect(sideLeft, y, sideWidth, bottom - y);
  ctx.fillStyle = gradient(ctx, sideRight - sideWidth, y, sideRight, y, BLACK_RIGHT_SIDE);
  ctx.fillRect(sideRight - sideWidth, y, sideWidth, bottom - y);

  const glintX = x + width * BLACK_GLINT_CENTRE;
  const glintRadius = width * BLACK_GLINT_RADIUS;
  const glint = ctx.createRadialGradient(glintX, lipTop, 0, glintX, lipTop, glintRadius);
  addStops(glint, BLACK_GLINT);
  ctx.fillStyle = glint;
  ctx.fillRect(glintX - glintRadius, lipTop - glintRadius, glintRadius * 2, glintRadius * 2);

  ctx.fillStyle = gradient(ctx, x, lipTop, x, bottom, BLACK_LIP_FACE);
  ctx.beginPath();
  ctx.roundRect(
    x + width * BLACK_LIP_INSET,
    lipTop,
    width * (1 - 2 * BLACK_LIP_INSET),
    lip,
    BLACK_LIP_RADII.map((radius) => radius * width)
  );
  ctx.fill();

  ctx.fillStyle = gradient(ctx, x, y, x, faceBottom, key.pressed ? BLACK_FACE_PRESSED : BLACK_FACE);
  ctx.beginPath();
  ctx.roundRect(x + width * BLACK_FACE_INSET, y, width * (1 - 2 * BLACK_FACE_INSET), Math.max(0, faceBottom - y), [
    0,
    0,
    faceRadius,
    faceRadius,
  ]);
  ctx.fill();
  tint(ctx, key.highlight);
}

function tint(ctx: CanvasRenderingContext2D, color: string | undefined): void {
  if (color === undefined) return;

  ctx.save();
  ctx.globalAlpha = TINT_OPACITY;
  // An unparsable colour leaves fillStyle untouched, so start from one that paints nothing.
  ctx.fillStyle = TRANSPARENT;
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function gradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: Stops
): CanvasGradient {
  const linear = ctx.createLinearGradient(x0, y0, x1, y1);
  addStops(linear, stops);
  return linear;
}

function addStops(target: CanvasGradient, stops: Stops): void {
  for (const [offset, color] of stops) target.addColorStop(offset, color);
}

export { paintDefaultKeys };
