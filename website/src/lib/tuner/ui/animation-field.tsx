import { useRef, type ReactNode } from 'react';
import {
  convertAnimation,
  summarizeAnimation,
  type Animation,
  type AnimationType,
  type EasingAnimation,
  type SpringAnimation,
  type TimeAnimation,
} from '../animation';
import { AnimationCurve } from './animation-curve';
import { AnimationIcon } from './icons';
import { PanelPopover } from './panel-popover';
import { Row } from './row';
import { SegmentedField } from './segmented-field';
import { SelectField } from './select-field';
import { SliderField } from './slider-field';

export type AnimationFieldProps = {
  label: string;
  value: Animation;
  onValueChange(value: Animation): void;
  defaultValue?: Animation;
  icon?: ReactNode;
  disabled?: boolean;
};

type EditorProps<A extends Animation> = {
  value: A;
  onValueChange(value: Animation): void;
  defaultValue: A | undefined;
};

type NumberRange = { min: number; max: number; step: number };

type NumberRowProps = {
  label: string;
  range: NumberRange;
  value: number;
  onValueChange(value: number): void;
  onReset?(): void;
  suffix?: string;
};

type CubicBezier = EasingAnimation['bezier'];

const TYPE_OPTIONS: readonly { value: AnimationType; label: string }[] = [
  { value: 'easing', label: 'Easing' },
  { value: 'time', label: 'Time' },
  { value: 'spring', label: 'Spring' },
];
const STIFFNESS: NumberRange = { min: 1, max: 1000, step: 1 };
const DAMPING: NumberRange = { min: 1, max: 100, step: 1 };
const MASS: NumberRange = { min: 0.1, max: 10, step: 0.1 };
const TIME_DURATION: NumberRange = { min: 100, max: 2000, step: 10 };
const EASING_DURATION: NumberRange = { min: 10, max: 2000, step: 10 };
const BOUNCE: NumberRange = { min: 0, max: 1, step: 0.01 };
const DELAY: NumberRange = { min: 0, max: 1000, step: 10 };
const CONVERSION_DECIMALS = 2;
const MILLISECONDS = 'ms';
const CUSTOM_EASING = 'custom';
const EASING_PRESETS: readonly { value: string; label: string; bezier: CubicBezier }[] = [
  { value: 'ease', label: 'Ease', bezier: [0.25, 0.1, 0.25, 1] },
  { value: 'ease-in', label: 'Ease in', bezier: [0.42, 0, 1, 1] },
  { value: 'ease-out', label: 'Ease out', bezier: [0, 0, 0.58, 1] },
  { value: 'ease-in-out', label: 'Ease in out', bezier: [0.42, 0, 0.58, 1] },
  { value: 'linear', label: 'Linear', bezier: [0, 0, 1, 1] },
];

export function AnimationField({ label, value, onValueChange, defaultValue, icon, disabled }: AnimationFieldProps) {
  return (
    <PanelPopover.Root>
      <PanelPopover.Toggle
        icon={icon ?? <AnimationIcon size="6" />}
        label={label}
        summary={summarizeAnimation(value)}
        disabled={disabled}
      />
      <PanelPopover.Popup className="tuner-AnimationPopover">
        <PanelPopover.Header>
          <PanelPopover.Title>{label}</PanelPopover.Title>
          <PanelPopover.Controls>
            <PanelPopover.Close />
          </PanelPopover.Controls>
        </PanelPopover.Header>
        <AnimationEditor value={value} onValueChange={onValueChange} defaultValue={defaultValue} />
      </PanelPopover.Popup>
    </PanelPopover.Root>
  );
}

function AnimationEditor({ value, onValueChange, defaultValue }: EditorProps<Animation>) {
  const editedTypes = useRef<Partial<Record<AnimationType, Animation>>>({});
  const switchType = (type: AnimationType) => {
    editedTypes.current[value.type] = value;
    onValueChange({ ...(editedTypes.current[type] ?? editableAs(value, type)), delay: value.delay });
  };
  return (
    <PanelPopover.Body>
      <SegmentedField
        aria-label="Animation type"
        value={value.type}
        onValueChange={switchType}
        options={TYPE_OPTIONS}
      />
      <AnimationCurve value={value} onValueChange={onValueChange} />
      <TypeFields value={value} onValueChange={onValueChange} defaultValue={defaultValue} />
    </PanelPopover.Body>
  );
}

function TypeFields({ value, defaultValue, ...props }: EditorProps<Animation>) {
  const typedDefault = defaultValue && editableAs(defaultValue, value.type);
  switch (value.type) {
    case 'spring':
      return (
        <SpringFields
          {...props}
          value={value}
          defaultValue={typedDefault?.type === 'spring' ? typedDefault : undefined}
        />
      );
    case 'time':
      return (
        <TimeFields {...props} value={value} defaultValue={typedDefault?.type === 'time' ? typedDefault : undefined} />
      );
    case 'easing':
      return (
        <EasingFields
          {...props}
          value={value}
          defaultValue={typedDefault?.type === 'easing' ? typedDefault : undefined}
        />
      );
  }
}

function SpringFields({ value, onValueChange, defaultValue }: EditorProps<SpringAnimation>) {
  const update = (patch: Partial<SpringAnimation>) => onValueChange({ ...value, ...patch });
  return (
    <>
      <NumberRow
        label="Stiffness"
        range={STIFFNESS}
        value={value.stiffness}
        onValueChange={(stiffness) => update({ stiffness })}
        onReset={defaultValue && (() => update({ stiffness: defaultValue.stiffness }))}
      />
      <NumberRow
        label="Damping"
        range={DAMPING}
        value={value.damping}
        onValueChange={(damping) => update({ damping })}
        onReset={defaultValue && (() => update({ damping: defaultValue.damping }))}
      />
      <NumberRow
        label="Mass"
        range={MASS}
        value={value.mass}
        onValueChange={(mass) => update({ mass })}
        onReset={defaultValue && (() => update({ mass: defaultValue.mass }))}
      />
      <DelayRow value={value.delay} onValueChange={(delay) => update({ delay })} defaultValue={defaultValue?.delay} />
    </>
  );
}

function TimeFields({ value, onValueChange, defaultValue }: EditorProps<TimeAnimation>) {
  const update = (patch: Partial<TimeAnimation>) => onValueChange({ ...value, ...patch });
  return (
    <>
      <NumberRow
        label="Duration"
        range={TIME_DURATION}
        suffix={MILLISECONDS}
        value={value.duration}
        onValueChange={(duration) => update({ duration })}
        onReset={defaultValue && (() => update({ duration: defaultValue.duration }))}
      />
      <NumberRow
        label="Bounce"
        range={BOUNCE}
        value={value.bounce}
        onValueChange={(bounce) => update({ bounce })}
        onReset={defaultValue && (() => update({ bounce: defaultValue.bounce }))}
      />
      <DelayRow value={value.delay} onValueChange={(delay) => update({ delay })} defaultValue={defaultValue?.delay} />
    </>
  );
}

function EasingFields({ value, onValueChange, defaultValue }: EditorProps<EasingAnimation>) {
  const update = (patch: Partial<EasingAnimation>) => onValueChange({ ...value, ...patch });
  const preset = EASING_PRESETS.find((candidate) => sameBezier(candidate.bezier, value.bezier));
  const choosePreset = (name: string) => {
    const chosen = EASING_PRESETS.find((candidate) => candidate.value === name);
    if (chosen) update({ bezier: chosen.bezier });
  };
  return (
    <>
      <Row.Root inline>
        <Row.Field>
          <Row.Label>Curve</Row.Label>
          <SelectField
            value={preset?.value ?? CUSTOM_EASING}
            onValueChange={choosePreset}
            options={preset ? EASING_PRESETS : [...EASING_PRESETS, { value: CUSTOM_EASING, label: 'Custom' }]}
          />
        </Row.Field>
      </Row.Root>
      <NumberRow
        label="Duration"
        range={EASING_DURATION}
        suffix={MILLISECONDS}
        value={value.duration}
        onValueChange={(duration) => update({ duration })}
        onReset={defaultValue && (() => update({ duration: defaultValue.duration }))}
      />
      <DelayRow value={value.delay} onValueChange={(delay) => update({ delay })} defaultValue={defaultValue?.delay} />
    </>
  );
}

function DelayRow({
  defaultValue,
  ...props
}: Omit<NumberRowProps, 'label' | 'range' | 'onReset'> & { defaultValue: number | undefined }) {
  const reset = defaultValue === undefined ? undefined : () => props.onValueChange(defaultValue);
  return <NumberRow {...props} label="Delay" range={DELAY} suffix={MILLISECONDS} onReset={reset} />;
}

function NumberRow({ label, range, ...field }: NumberRowProps) {
  return (
    <Row.Root inline>
      <Row.Field>
        <Row.Label>{label}</Row.Label>
        <SliderField {...field} {...range} />
      </Row.Field>
    </Row.Root>
  );
}

function editableAs(animation: Animation, type: AnimationType): Animation {
  return animation.type === type ? animation : withinRanges(convertAnimation(animation, type));
}

function withinRanges(animation: Animation): Animation {
  switch (animation.type) {
    case 'spring':
      return springWithinRanges(animation);
    case 'time':
      return {
        ...animation,
        duration: within(animation.duration, TIME_DURATION),
        bounce: within(animation.bounce, BOUNCE),
      };
    case 'easing':
      return { ...animation, duration: within(animation.duration, EASING_DURATION) };
  }
}

function springWithinRanges(spring: SpringAnimation): SpringAnimation {
  const sameMotionScale = Math.min(1, STIFFNESS.max / spring.stiffness, DAMPING.max / spring.damping);
  return {
    ...spring,
    stiffness: within(spring.stiffness * sameMotionScale, STIFFNESS),
    damping: within(spring.damping * sameMotionScale, DAMPING),
    mass: within(spring.mass * sameMotionScale, MASS),
  };
}

function within(value: number, { min, max }: NumberRange): number {
  return Number(Math.min(Math.max(value, min), max).toFixed(CONVERSION_DECIMALS));
}

function sameBezier(first: CubicBezier, second: CubicBezier): boolean {
  return first.every((value, index) => value === second[index]);
}
