import type { ReactNode } from 'react';
import { Legend } from '@/components/hardware/legend';
import { Rule } from '@/components/hardware/rule';

type ModuleProps = { title: string; span: number; children: ReactNode };

function Module({ title, span, children }: ModuleProps) {
  return (
    <section className="demo-Module" style={{ '--span': span }}>
      <Rule orientation="vertical" className="demo-ModuleDivider" />
      <ModuleTitle>{title}</ModuleTitle>
      {children}
    </section>
  );
}

function ModuleTitle({ children }: { children: ReactNode }) {
  return (
    <div className="demo-ModuleTitle">
      <Legend>{children}</Legend>
    </div>
  );
}

type LabeledProps = { label: string; size?: 'small' | 'large'; children: ReactNode };

function Labeled({ label, size = 'small', children }: LabeledProps) {
  return (
    <div className="demo-Labeled" data-size={size}>
      {children}
      <Legend>{label}</Legend>
    </div>
  );
}

export { Labeled, Module, ModuleTitle };
