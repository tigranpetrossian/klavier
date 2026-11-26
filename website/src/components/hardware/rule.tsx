import { Separator } from '@base-ui/react/separator';
import { classNames } from './class-names';
import './lighting.css';
import './surface.css';
import './recess.css';
import './rule.css';

type RuleProps = {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
};

function Rule({ orientation = 'horizontal', className }: RuleProps) {
  return <Separator orientation={orientation} className={classNames('hw-Rule hw-Recess', className)} />;
}

export { Rule };
