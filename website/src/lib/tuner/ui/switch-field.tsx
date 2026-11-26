import { Label, Switch } from 'figma-kit';
import type { ReactNode } from 'react';

export type SwitchFieldProps = {
  value: boolean;
  onValueChange(value: boolean): void;
  label: ReactNode;
  detail?: ReactNode;
  disabled?: boolean;
};

export function SwitchField({ value, onValueChange, label, detail, disabled }: SwitchFieldProps) {
  return (
    <Label className="tuner-SwitchField">
      <Switch checked={value} disabled={disabled} onCheckedChange={onValueChange} />
      <span className="tuner-SwitchFieldLabel">{label}</span>
      {detail !== undefined && <span className="tuner-SwitchFieldDetail">{detail}</span>}
    </Label>
  );
}
