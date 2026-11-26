import { Drawer as BaseDrawer } from '@base-ui/react/drawer';
import { IconButton, MinusIcon, SlidersIcon, Text } from 'figma-kit';
import type { ReactNode } from 'react';
import { useTuningSession } from '../../react';
import { ShadowHost } from '../shadow-host';
import { Redo, Reset, Save, Undo } from './panel-actions';
import { usePanelOpen } from './panel-open';
import { PanelSession } from './panel-session';
import { useShortcuts } from './shortcuts';

type SlotProps = { children?: ReactNode };

function Root({ children }: SlotProps) {
  const session = useTuningSession();
  const [open, setOpen] = usePanelOpen();
  useShortcuts(open, [
    { keys: 'Shift+D', run: () => setOpen(!open), whenClosed: true },
    { keys: 'Mod+Z', run: session.undo, repeat: true },
    { keys: 'Mod+Shift+Z', run: session.redo, repeat: true },
  ]);
  return (
    <PanelSession value={session}>
      <BaseDrawer.Root open={open} onOpenChange={setOpen} modal={false} disablePointerDismissal swipeDirection="right">
        {children}
      </BaseDrawer.Root>
    </PanelSession>
  );
}

function Trigger() {
  return (
    <ShadowHost>
      {() => (
        <BaseDrawer.Trigger className="tuner-Trigger" render={<IconButton aria-label="Open tuner" size="small" />}>
          <SlidersIcon size="6" />
        </BaseDrawer.Trigger>
      )}
    </ShadowHost>
  );
}

function Drawer({ children }: SlotProps) {
  return (
    <ShadowHost>
      {(container) => (
        <BaseDrawer.Portal container={container}>
          <BaseDrawer.Viewport className="tuner-Viewport">
            <BaseDrawer.Popup className="tuner-Panel">{children}</BaseDrawer.Popup>
          </BaseDrawer.Viewport>
        </BaseDrawer.Portal>
      )}
    </ShadowHost>
  );
}

function Header({ children }: SlotProps) {
  return <div className="tuner-Header">{children}</div>;
}

function Title({ children }: SlotProps) {
  return <BaseDrawer.Title render={<Text className="tuner-Title" weight="strong" />}>{children}</BaseDrawer.Title>;
}

function Close() {
  return (
    <BaseDrawer.Close render={<IconButton aria-label="Close tuner" size="small" />}>
      <MinusIcon size="6" />
    </BaseDrawer.Close>
  );
}

function Body({ children }: SlotProps) {
  return <BaseDrawer.Content className="tuner-Body">{children}</BaseDrawer.Content>;
}

function Footer({ children }: SlotProps) {
  return <div className="tuner-Footer">{children}</div>;
}

export const Panel = { Root, Trigger, Drawer, Header, Title, Undo, Redo, Close, Body, Footer, Reset, Save };
