export type Unit = '' | 'px' | 'deg' | 'em';

export type NumberSpec = {
  kind: 'number';
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: Unit;
};

export type ColorSpec = { kind: 'color'; name: string; label: string };

export type AngleSpec = { kind: 'angle'; name: string; label: string };

export type ConstantSpec = {
  kind: 'constant';
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  fallback: number;
};

export type RowSpec = NumberSpec | ColorSpec | AngleSpec | ConstantSpec;

export type SectionSpec = { title: string; open: boolean; rows: readonly RowSpec[] };

const FINE_STEP = 0.01;
const DEFAULT_STRENGTH_MAX = 2;
const RECESS_SCALE_MAX = 4;

export const SECTIONS: readonly SectionSpec[] = [
  {
    title: 'Light',
    open: true,
    rows: [
      { kind: 'angle', name: '--light-angle', label: 'Light angle' },
      strength('--elevation', 'Elevation'),
      strength('--shadow-strength', 'Shadow strength'),
      strength('--highlight-strength', 'Highlight strength'),
      strength('--sheen', 'Sheen'),
      strength('--lamp-glow', 'Lamp glow'),
      color('--shadow-color', 'Shadow'),
      color('--highlight-color', 'Highlight'),
      color('--lamp-color', 'Lamp'),
      color('--ink-color', 'Ink'),
    ],
  },
  {
    title: 'Recess',
    open: true,
    rows: [
      strength('--recess-depth', 'Depth', 1),
      strength('--recess-highlight', 'Edge highlight', 1),
      strength('--recess-shadow', 'Edge shadow', 1),
      px('--recess-edge', 'Edge width', 0, 3, 0.05),
      px('--recess-softness', 'Edge softness', 0, 3, 0.05),
      color('--recess-color-deep', 'Floor, near light'),
      color('--recess-color', 'Floor, far from light'),
    ],
  },
  {
    title: 'Surface',
    open: true,
    rows: [
      color('--surface-color-lit', 'Lit'),
      color('--surface-color', 'Base'),
      color('--surface-color-shade', 'Shade'),
      color('--surface-edge-color', 'Edge'),
      px('--surface-radius', 'Radius', 0, 64),
      px('--surface-padding', 'Padding', 12, 64),
      px('--surface-thickness', 'Thickness', 0, 12, 0.5),
      strength('--surface-chamfer', 'Chamfer'),
      strength('--surface-vignette', 'Vignette'),
      strength('--surface-drop', 'Drop shadow'),
      strength('--grain', 'Grain', 1),
      px('--grain-size', 'Grain size', 128, 1024, 8),
      strength('--speckle', 'Speckle', 1),
      ...recessScales('--rule', 'Rule'),
    ],
  },
  {
    title: 'Backdrop',
    open: false,
    rows: [
      color('--page-color', 'Page'),
      strength('--backdrop-glow', 'Glow', 0.4),
      strength('--backdrop-grain', 'Grain', 1),
    ],
  },
  {
    title: 'Legend',
    open: false,
    rows: [
      px('--legend-size', 'Size', 8, 16, 0.5),
      number('--legend-weight', 'Weight', 300, 800, 10),
      number('--legend-tracking', 'Tracking', -0.06, 0.12, 0.001, 'em'),
      strength('--legend-dim', 'Dim tone', 1),
    ],
  },
  {
    title: 'Knob',
    open: false,
    rows: [
      color('--knob-color', 'Cap'),
      color('--knob-wall-color', 'Wall'),
      color('--knob-pointer-color', 'Pointer'),
      number('--knob-hole', 'Hole', 0, 0.1, 0.002),
      ...recessScales('--knob-hole', 'Hole'),
      number('--knob-wall', 'Wall', 0, 0.1, 0.002),
      strength('--knob-wall-shade', 'Wall shade', 1),
      number('--knob-shadow', 'Shadow', 0, 0.3, 0.005),
      px('--knob-bevel', 'Edge bevel', 0, 8, 0.25),
      strength('--knob-specular', 'Edge highlight'),
      strength('--knob-brushed', 'Brushed', 1.5),
      strength('--knob-streaks', 'Streaks'),
      number('--knob-pointer-length', 'Pointer length', 0.04, 0.45, 0.005),
      number('--knob-pointer-width', 'Pointer width', 0.01, 0.08, 0.002),
      number('--knob-pointer-inset', 'Pointer inset', 0, 0.3, 0.005),
      px('--knob-scale-gap', 'Scale gap', 2, 24, 0.5),
      px('--knob-arc-width', 'Arc width', 1, 6, 0.25),
      ...recessScales('--knob-arc', 'Arc'),
      px('--knob-dot-size', 'Dot size', 1, 6, 0.25),
      strength('--knob-scale-opacity', 'Printed dots', 1),
      constant('knob.sweepDegrees', 'Sweep', 180, 330, 5, 270),
      constant('knob.dragDistance', 'Drag distance', 60, 400, 10, 180),
      constant('knob.fineFactor', 'Fine drag factor', 0.05, 1, 0.05, 0.2),
    ],
  },
  {
    title: 'Toggle and segments',
    open: false,
    rows: [
      color('--key-color', 'Cap'),
      color('--key-wall-color', 'Wall'),
      color('--key-legend-color', 'Legend'),
      px('--key-height', 'Height', 20, 48),
      px('--key-radius', 'Radius', 0, 24, 0.5),
      px('--key-round-size', 'Round size', 24, 56),
      px('--key-hole', 'Hole', 0, 5, 0.25),
      ...recessScales('--key-hole', 'Hole'),
      px('--key-wall', 'Wall', 0, 4, 0.25),
      px('--key-shadow', 'Shadow', 0, 10, 0.25),
      px('--key-bevel', 'Edge bevel', 0, 8, 0.25),
      strength('--key-specular', 'Edge highlight'),
      px('--key-press', 'Pressed depth', 0, 6, 0.25),
      strength('--key-pressed-shade', 'Pressed shade', 0.4),
      number('--key-held-depth', 'Held depth', 1, 3, FINE_STEP),
      px('--segment-gap', 'Segment gap', 0, 4, 0.25),
      px('--segment-inner-radius', 'Segment inner radius', 0, 8, 0.5),
    ],
  },
  {
    title: 'Slider',
    open: false,
    rows: [
      color('--slider-cap-color', 'Cap'),
      color('--slider-cap-wall-color', 'Wall'),
      color('--slider-line-color', 'Line'),
      px('--slider-slot-width', 'Slot width', 2, 14, 0.5),
      ...recessScales('--slider-slot', 'Slot'),
      px('--slider-cap-length', 'Cap length', 18, 64),
      px('--slider-cap-width', 'Cap width', 12, 44),
      px('--slider-cap-radius', 'Cap radius', 0, 12, 0.5),
      px('--slider-cap-wall', 'Wall', 0, 4, 0.25),
      px('--slider-cap-shadow', 'Shadow', 0, 12, 0.25),
      px('--slider-cap-bevel', 'Edge bevel', 0, 8, 0.25),
      strength('--slider-cap-specular', 'Edge highlight'),
      strength('--slider-cap-scoop', 'Scoop'),
      strength('--slider-cap-ridges', 'Ridges'),
      px('--slider-tick-length', 'Tick length', 2, 12, 0.5),
      px('--slider-tick-gap', 'Tick gap', 0, 12, 0.5),
      strength('--slider-tick-opacity', 'Tick opacity', 1),
      px('--slider-strip-width', 'Strip width', 1, 4, 0.25),
    ],
  },
  {
    title: 'Selector',
    open: false,
    rows: [
      px('--selector-gap', 'Gap', 0, 16),
      px('--selector-popup-radius', 'Menu radius', 0, 20),
      px('--selector-item-height', 'Menu item height', 20, 40),
    ],
  },
  {
    title: 'Meter',
    open: false,
    rows: [
      color('--meter-color', 'Signal'),
      color('--meter-peak-color', 'Peak'),
      px('--meter-segment-gap', 'Segment gap', 0, 5, 0.25),
      px('--meter-segment-thickness', 'Segment thickness', 1, 10, 0.5),
      px('--meter-segment-length', 'Segment length', 4, 20, 0.5),
      strength('--meter-off-opacity', 'Unlit opacity', 0.4),
      px('--meter-padding', 'Padding', 1, 10, 0.5),
      constant('meter.segments', 'Segments', 6, 32, 1, 16),
      constant('meter.peakSegments', 'Peak segments', 0, 8, 1, 3),
    ],
  },
  {
    title: 'Screen',
    open: false,
    rows: [
      color('--screen-color', 'Glass'),
      color('--screen-color-lit', 'Glass, lit'),
      color('--screen-ink-color', 'Ink'),
      px('--screen-radius', 'Radius', 0, 24, 0.5),
      px('--screen-bezel', 'Bezel', 0, 8, 0.25),
      ...recessScales('--screen-bezel', 'Bezel'),
      strength('--screen-gloss', 'Gloss'),
      strength('--screen-glow', 'Trace glow'),
      strength('--screen-grid', 'Pixel grid', 1),
    ],
  },
  {
    title: 'Indicator light',
    open: false,
    rows: [color('--lamp-housing-color', 'Housing'), strength('--lamp-idle-tint', 'Idle tint', 0.5)],
  },
  {
    title: 'Layout',
    open: false,
    rows: [
      px('--demo-margin', 'Margin', 0, 80),
      px('--demo-gutter', 'Gutter', 16, 72),
      px('--demo-row-gap', 'Row gap', 8, 48),
      px('--demo-stack-gap', 'Stack gap', 8, 40),
      px('--demo-keyboard-height', 'Keyboard height', 80, 260),
      ...recessScales('--demo-key-bay', 'Key bay'),
    ],
  },
];

function number(name: string, label: string, min: number, max: number, step: number, unit: Unit = ''): NumberSpec {
  return { kind: 'number', name, label, min, max, step, unit };
}

function strength(name: string, label: string, max = DEFAULT_STRENGTH_MAX): NumberSpec {
  return number(name, label, 0, max, FINE_STEP);
}

function recessScales(prefix: string, part: string): NumberSpec[] {
  return [
    strength(`${prefix}-recess-depth-scale`, `${part} recess depth scale`, RECESS_SCALE_MAX),
    strength(`${prefix}-recess-highlight-scale`, `${part} recess highlight scale`, RECESS_SCALE_MAX),
    strength(`${prefix}-recess-shadow-scale`, `${part} recess shadow scale`, RECESS_SCALE_MAX),
    strength(`${prefix}-recess-softness-scale`, `${part} recess softness scale`, RECESS_SCALE_MAX),
  ];
}

function px(name: string, label: string, min: number, max: number, step = 1): NumberSpec {
  return number(name, label, min, max, step, 'px');
}

function color(name: string, label: string): ColorSpec {
  return { kind: 'color', name, label };
}

function constant(id: string, label: string, min: number, max: number, step: number, fallback: number): ConstantSpec {
  return { kind: 'constant', id, label, min, max, step, fallback };
}
