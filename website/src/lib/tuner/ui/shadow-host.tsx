import { useCallback, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useColorScheme, type ColorScheme } from './color-scheme';
import { shadowStylesheets } from './shadow-stylesheets';
import { TUNER_SCOPE_CLASS_NAME } from './tuner-scope';

type ShadowHostProps = { children: (container: HTMLElement) => ReactNode };

const HOST_STYLE: CSSProperties = { display: 'contents' };
const SCOPE_CLASS_NAMES: Record<ColorScheme, string> = {
  light: TUNER_SCOPE_CLASS_NAME,
  dark: `${TUNER_SCOPE_CLASS_NAME} figma-dark`,
};

export function ShadowHost({ children }: ShadowHostProps) {
  const colorScheme = useColorScheme();
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const attachHost = useCallback((host: HTMLDivElement | null) => {
    if (host) setShadowRoot(openShadowRoot(host));
  }, []);
  return (
    <div ref={attachHost} style={HOST_STYLE}>
      {shadowRoot &&
        createPortal(
          <div ref={setContainer} className={SCOPE_CLASS_NAMES[colorScheme]}>
            {container && children(container)}
          </div>,
          shadowRoot
        )}
    </div>
  );
}

function openShadowRoot(host: HTMLElement): ShadowRoot {
  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadowRoot.adoptedStyleSheets = [...shadowStylesheets()];
  return shadowRoot;
}
