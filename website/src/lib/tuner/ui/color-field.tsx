import { ColorPicker, ValueField } from 'figma-kit';
import type { CSSProperties } from 'react';
import { convertColor, formatColor, parseColor, type ColorModel } from '../color';
import { colorModelOf } from '../runtime/type-checks';
import { PanelPopover } from './panel-popover';
import { useFieldName } from './row';

type Rgba = ValueField.HexProps['value'];

export type ColorFieldProps = {
  value: string;
  onValueChange(value: string): void;
  disabled?: boolean;
  'aria-label'?: string;
};

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
const FALLBACK_MODEL: ColorModel = 'hex';
const CHANNEL_MAX = 255;
const PICKER_MODELS: ColorPicker.ColorModel[] = ['hex', 'rgb', 'hsl'];
const CHECKERBOARD =
  'repeating-conic-gradient(var(--figma-color-bg-tertiary) 0 25%, var(--figma-color-bg) 0 50%) 0 0 / 8px 8px';

export function ColorField(props: ColorFieldProps) {
  const { value, onValueChange, disabled } = props;
  const name = useFieldName(props['aria-label']);
  const color = toRgba(value) ?? BLACK;
  const model = colorModelOf(value) ?? FALLBACK_MODEL;
  const change = (next: Rgba) => {
    onValueChange(toCss(next, model));
  };
  return (
    <ValueField.Multi className="tuner-ColorField" disabled={disabled}>
      <PanelPopover.Root>
        <PanelPopover.Trigger
          className="tuner-ColorSwatch"
          aria-label="Edit color"
          disabled={disabled}
          style={swatchStyle(color)}
        />
        <PanelPopover.Popup className="tuner-ColorPopover">
          <ColorPicker.Root colorSpace="srgb" models={PICKER_MODELS} color={color} onColorChange={change}>
            <ColorPicker.Area />
            <PanelPopover.Body>
              <ColorPicker.Hue />
              <ColorPicker.Alpha />
              <ColorPicker.Input />
            </PanelPopover.Body>
          </ColorPicker.Root>
        </PanelPopover.Popup>
      </PanelPopover.Root>
      <ValueField.Root>
        <ValueField.Hex {...name} value={color} onChange={(next) => change({ ...next, a: color.a })} ignoreAlpha />
      </ValueField.Root>
      <ValueField.Root className="tuner-ColorFieldAlpha">
        <ValueField.Scrubber />
        <ValueField.Numeric
          aria-label="Opacity"
          value={color.a}
          onChange={(alpha) => change({ ...color, a: alpha })}
          min={0}
          max={1}
          scale={100}
          precision={0}
          suffix="%"
        />
      </ValueField.Root>
    </ValueField.Multi>
  );
}

function toRgba(css: string): Rgba | null {
  const parsed = parseColor(css);
  if (parsed === null) return null;
  const { r, g, b, alpha } = convertColor(parsed, 'rgb');
  return { r: r / CHANNEL_MAX, g: g / CHANNEL_MAX, b: b / CHANNEL_MAX, a: alpha };
}

function toCss({ r, g, b, a }: Rgba, model: ColorModel): string {
  return formatColor({ model: 'rgb', r: r * CHANNEL_MAX, g: g * CHANNEL_MAX, b: b * CHANNEL_MAX, alpha: a }, model);
}

function swatchStyle(color: Rgba): CSSProperties {
  const fill = toCss(color, 'rgb');
  return { background: `linear-gradient(${fill}, ${fill}), ${CHECKERBOARD}` };
}
