import { IconButton, SlidersIcon, Tabs, Text, Tooltip } from 'figma-kit';
import { featureEnabled, withFeature, type FontAxis, type FontOption, type FontSettings } from './font-settings';
import { PanelPopover } from './panel-popover';
import { Row } from './row';
import { SliderField } from './slider-field';
import { SwitchField } from './switch-field';

export type FontSettingsControl = {
  value: FontSettings;
  onValueChange(value: FontSettings): void;
  disabled?: boolean;
};

export type TypeSettingsProps = {
  font: FontOption | undefined;
  axes: FontSettingsControl;
  features: FontSettingsControl;
  label?: string;
};

const DEFAULT_LABEL = 'Type settings';
const FINE_AXIS_SPAN = 2;
const FINE_AXIS_STEP = 0.01;
const AXIS_STEP = 1;
const AXES_TAB = 'variable';
const FEATURES_TAB = 'features';

export function TypeSettings({ font, axes, features, label = DEFAULT_LABEL }: TypeSettingsProps) {
  return (
    <PanelPopover.Root>
      <Tooltip content={label}>
        <PanelPopover.Trigger render={<IconButton aria-label={label} size="small" />}>
          <SlidersIcon size="6" />
        </PanelPopover.Trigger>
      </Tooltip>
      <PanelPopover.Popup className="tuner-TypeSettings" aria-label={label}>
        <Tabs.Root defaultValue={AXES_TAB} className="tuner-TypeSettingsTabs">
          <PanelPopover.Header>
            <Tabs.List>
              <Tabs.Tab value={AXES_TAB}>Variable</Tabs.Tab>
              <Tabs.Tab value={FEATURES_TAB}>Features</Tabs.Tab>
            </Tabs.List>
            <PanelPopover.Controls>
              <PanelPopover.Close />
            </PanelPopover.Controls>
          </PanelPopover.Header>
          <Tabs.Panel value={AXES_TAB}>
            <PanelPopover.Body>
              <AxisRows axes={font?.axes ?? []} control={axes} />
            </PanelPopover.Body>
          </Tabs.Panel>
          <Tabs.Panel value={FEATURES_TAB}>
            <PanelPopover.Body className="tuner-TypeSettingsFeatures">
              <FeatureRows font={font} control={features} />
            </PanelPopover.Body>
          </Tabs.Panel>
        </Tabs.Root>
      </PanelPopover.Popup>
    </PanelPopover.Root>
  );
}

function AxisRows({ axes, control }: { axes: readonly FontAxis[]; control: FontSettingsControl }) {
  if (axes.length === 0) return <EmptyMessage>This font has no variable axes.</EmptyMessage>;
  return axes.map((axis) => (
    <Row.Root key={axis.tag} inline>
      <Row.Field>
        <Row.Label>{axis.name}</Row.Label>
        <SliderField
          value={control.value[axis.tag] ?? axis.defaultValue}
          onValueChange={(value) => control.onValueChange({ ...control.value, [axis.tag]: value })}
          onReset={() => control.onValueChange({ ...control.value, [axis.tag]: axis.defaultValue })}
          min={axis.min}
          max={axis.max}
          step={axisStep(axis)}
          disabled={control.disabled}
        />
      </Row.Field>
    </Row.Root>
  ));
}

function FeatureRows({ font, control }: { font: FontOption | undefined; control: FontSettingsControl }) {
  const features = font?.features ?? [];
  if (features.length === 0) return <EmptyMessage>This font has no OpenType features.</EmptyMessage>;
  return features.map((feature) => (
    <SwitchField
      key={feature.tag}
      label={feature.name}
      detail={feature.tag}
      value={featureEnabled(control.value, feature.tag)}
      onValueChange={(enabled) => control.onValueChange(withFeature(control.value, feature.tag, enabled))}
      disabled={control.disabled}
    />
  ));
}

function EmptyMessage({ children }: { children: string }) {
  return (
    <Text color="secondary" block>
      {children}
    </Text>
  );
}

function axisStep(axis: FontAxis): number {
  return axis.max - axis.min <= FINE_AXIS_SPAN ? FINE_AXIS_STEP : AXIS_STEP;
}
