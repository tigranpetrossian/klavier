'use client';

import { Toggle as BaseToggle } from '@base-ui/react/toggle';
import type { ReactNode } from 'react';
import { classNames } from './class-names';
import { Lamp } from './lamp';
import './lighting.css';
import './surface.css';
import './recess.css';
import './legend.css';
import './key.css';

type ToggleShape = 'rect' | 'round';

type ToggleProps = {
  pressed: boolean;
  onPressedChange(pressed: boolean): void;
  shape?: ToggleShape;
  lamp?: boolean;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  'aria-label'?: string;
};

function Toggle(props: ToggleProps) {
  const { pressed, onPressedChange, shape = 'rect', lamp = true, disabled, children, className } = props;
  return (
    <BaseToggle
      className={classNames('hw-Key hw-Recess hw-LegendType', className)}
      data-shape={shape}
      aria-label={props['aria-label']}
      pressed={pressed}
      disabled={disabled}
      onPressedChange={onPressedChange}
    >
      {lamp && <Lamp on={pressed} shape={shape === 'rect' ? 'pill' : 'round'} />}
      {children}
    </BaseToggle>
  );
}

export { Toggle };
export type { ToggleProps, ToggleShape };
