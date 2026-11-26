import { Collapsible, Text } from 'figma-kit';
import { createContext, use, type ComponentProps } from 'react';
import { addClassName } from './add-class-name';

type StaticRootProps = ComponentProps<'div'> & { collapsible?: false };

type CollapsibleRootProps = ComponentProps<typeof Collapsible.Root> & { collapsible: true };

const SectionCollapsibleContext = createContext(false);

function Root(props: StaticRootProps | CollapsibleRootProps) {
  return props.collapsible ? <CollapsibleRoot {...props} /> : <StaticRoot {...props} />;
}

function Header({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={addClassName('tuner-SectionHeader', className)} />;
}

function Trigger({ className, ...props }: ComponentProps<typeof Collapsible.Trigger>) {
  return <Collapsible.Trigger {...props} className={addClassName('tuner-SectionTrigger', className)} />;
}

function Title({ className, ...props }: ComponentProps<typeof Text>) {
  return <Text weight="strong" {...props} className={addClassName('tuner-SectionTitle', className)} />;
}

function Body({ className, ...props }: ComponentProps<'div'>) {
  const bodyClassName = addClassName('tuner-SectionBody', className);
  return use(SectionCollapsibleContext) ? (
    <Collapsible.Panel {...props} className={bodyClassName} />
  ) : (
    <div {...props} className={bodyClassName} />
  );
}

function StaticRoot({ collapsible = false, className, ...props }: StaticRootProps) {
  return (
    <SectionCollapsibleContext value={collapsible}>
      <div {...props} className={addClassName('tuner-Section', className)} />
    </SectionCollapsibleContext>
  );
}

function CollapsibleRoot({ collapsible, className, defaultOpen = true, ...props }: CollapsibleRootProps) {
  return (
    <SectionCollapsibleContext value={collapsible}>
      <Collapsible.Root {...props} defaultOpen={defaultOpen} className={addClassName('tuner-Section', className)} />
    </SectionCollapsibleContext>
  );
}

export const Section = { Root, Header, Trigger, Title, Body };
