import { Popover, Text } from 'figma-kit';
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  type Ref,
  type SetStateAction,
} from 'react';
import { addClassName } from './add-class-name';

type VirtualAnchor = { getBoundingClientRect(): DOMRect; contextElement: Element };

type TriggerElementState = { trigger: HTMLElement | null; setTrigger: Dispatch<SetStateAction<HTMLElement | null>> };

type ToggleProps = { icon: ReactNode; label: string; summary: string; disabled?: boolean };

const PANEL_SELECTOR = '.tuner-Panel';
const POPOVER_SELECTOR = '.tuner-PanelPopover';
const VIEWPORT_PADDING = 8;

const TriggerElementContext = createContext<TriggerElementState>({ trigger: null, setTrigger: () => {} });

function Root(props: ComponentProps<typeof Popover.Root>) {
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const state = useMemo(() => ({ trigger, setTrigger }), [trigger]);
  return (
    <TriggerElementContext value={state}>
      <Popover.Root {...props} />
    </TriggerElementContext>
  );
}

function Trigger({ ref, ...props }: ComponentProps<typeof Popover.Trigger>) {
  const { setTrigger } = use(TriggerElementContext);
  const attachTrigger = useCallback(
    (element: HTMLButtonElement | null) => {
      setTrigger(element);
      assignRef(ref, element);
    },
    [ref, setTrigger]
  );
  return <Popover.Trigger {...props} ref={attachTrigger} />;
}

function Toggle({ icon, label, summary, disabled }: ToggleProps) {
  return (
    <Trigger className="tuner-PopoverToggle" disabled={disabled}>
      <span className="tuner-PopoverToggleIcon">{icon}</span>
      <span className="tuner-PopoverToggleText">
        <Text className="tuner-PopoverToggleLabel">{label}</Text>
        <Text className="tuner-PopoverToggleSummary" color="secondary">
          {summary}
        </Text>
      </span>
    </Trigger>
  );
}

function Popup({ className, ...props }: ComponentProps<typeof Popover.Popup>) {
  const { trigger } = use(TriggerElementContext);
  const anchor = useMemo(() => (trigger === null ? undefined : popoverAnchor(trigger)), [trigger]);
  return (
    <Popover.Portal>
      <Popover.Positioner
        className="tuner-PanelPopoverPositioner"
        anchor={anchor}
        side="left"
        align="start"
        collisionPadding={VIEWPORT_PADDING}
      >
        <Popover.Popup {...props} className={addClassName('tuner-PanelPopover', className)} />
      </Popover.Positioner>
    </Popover.Portal>
  );
}

function Body({ className, ...props }: ComponentProps<typeof Popover.Section>) {
  return <Popover.Section {...props} className={addClassName('tuner-PanelPopoverBody', className)} />;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

function popoverAnchor(trigger: HTMLElement): VirtualAnchor {
  const parentPopover = trigger.closest(POPOVER_SELECTOR);
  return parentPopover === null ? panelEdgeAnchor(trigger) : popoverEdgeAnchor(trigger, parentPopover);
}

function popoverEdgeAnchor(trigger: HTMLElement, popover: Element): VirtualAnchor {
  return {
    contextElement: trigger,
    getBoundingClientRect: () => {
      const popoverBox = popover.getBoundingClientRect();
      return new DOMRect(popoverBox.left, popoverBox.top, 0, popoverBox.height);
    },
  };
}

function panelEdgeAnchor(trigger: HTMLElement): VirtualAnchor {
  return {
    contextElement: trigger,
    getBoundingClientRect: () => {
      const triggerBox = trigger.getBoundingClientRect();
      const panelBox = (trigger.closest(PANEL_SELECTOR) ?? trigger).getBoundingClientRect();
      return new DOMRect(panelBox.left, triggerBox.top, 0, triggerBox.height);
    },
  };
}

export const PanelPopover = {
  Root,
  Trigger,
  Toggle,
  Popup,
  Header: Popover.Header,
  Title: Popover.Title,
  Controls: Popover.Controls,
  Close: Popover.Close,
  Body,
};
