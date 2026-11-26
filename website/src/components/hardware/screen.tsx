import type { ReactNode } from 'react';
import { classNames } from './class-names';
import './lighting.css';
import './surface.css';
import './recess.css';
import './legend.css';
import './screen.css';

type ScreenProps = { children?: ReactNode; className?: string };

function Screen({ children, className }: ScreenProps) {
  return (
    <div className={classNames('hw-Screen hw-Recess', className)}>
      <div className="hw-ScreenGlass">
        <div className="hw-ScreenContent hw-LegendType">{children}</div>
      </div>
    </div>
  );
}

export { Screen };
