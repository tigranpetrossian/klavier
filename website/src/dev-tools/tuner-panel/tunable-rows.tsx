import type { ReactNode } from 'react';
import type { AngleSpec, ColorSpec, ConstantSpec, NumberSpec, RowSpec, Unit } from './tunable-sections';
import { useProperty, useTunable, type PropertyCodec } from '@/lib/tuner/react';
import {
  ColorField,
  CSS_COLOR,
  cssNumber,
  LightAngle,
  NumberField,
  ResetButton,
  Row,
  SliderField,
} from '@/lib/tuner/ui';

const NUMBER_CODECS: Record<Unit, PropertyCodec<number>> = {
  '': cssNumber(),
  px: cssNumber('px'),
  deg: cssNumber('deg'),
  em: cssNumber('em'),
};
const HALF_TURN = 180;
const ANGLE_LAYOUT = { display: 'flex', alignItems: 'center', gap: 8 };

export function TunableRow({ spec }: { spec: RowSpec }) {
  if (spec.kind === 'number') return <NumberPropertyRow spec={spec} />;
  if (spec.kind === 'color') return <ColorPropertyRow spec={spec} />;
  if (spec.kind === 'angle') return <AnglePropertyRow spec={spec} />;
  return <ConstantRow spec={spec} />;
}

function NumberPropertyRow({ spec }: { spec: NumberSpec }) {
  const control = useProperty(spec.name, { codec: NUMBER_CODECS[spec.unit] });
  return (
    <LabeledRow label={spec.label} reset={<ResetButton {...control} />}>
      <SliderField {...control} min={spec.min} max={spec.max} step={spec.step} suffix={spec.unit} />
    </LabeledRow>
  );
}

function ColorPropertyRow({ spec }: { spec: ColorSpec }) {
  const control = useProperty(spec.name, { codec: CSS_COLOR });
  return (
    <LabeledRow label={spec.label} reset={<ResetButton {...control} />}>
      <ColorField {...control} />
    </LabeledRow>
  );
}

function AnglePropertyRow({ spec }: { spec: AngleSpec }) {
  const control = useProperty(spec.name, { codec: NUMBER_CODECS.deg });
  return (
    <LabeledRow label={spec.label} reset={<ResetButton {...control} />}>
      <div style={ANGLE_LAYOUT}>
        <LightAngle value={control.value} onValueChange={control.onValueChange} />
        <NumberField {...control} min={-HALF_TURN} max={HALF_TURN} step={1} suffix="°" />
      </div>
    </LabeledRow>
  );
}

function ConstantRow({ spec }: { spec: ConstantSpec }) {
  const control = useTunable(spec.id, isNumber, spec.fallback);
  return (
    <LabeledRow label={spec.label} reset={<ResetButton {...control} />}>
      <SliderField {...control} min={spec.min} max={spec.max} step={spec.step} />
    </LabeledRow>
  );
}

type LabeledRowProps = { label: string; reset: ReactNode; children: ReactNode };

function LabeledRow({ label, reset, children }: LabeledRowProps) {
  return (
    <Row.Root>
      <Row.Field span={2}>
        <Row.Label>{label}</Row.Label>
        {children}
      </Row.Field>
      <Row.Rail>{reset}</Row.Rail>
    </Row.Root>
  );
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}
