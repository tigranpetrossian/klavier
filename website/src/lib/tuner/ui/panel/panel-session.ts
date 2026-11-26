import { createContext, use } from 'react';
import type { TuningSessionControls } from '../../react';

export const PanelSession = createContext<TuningSessionControls | null>(null);

export function usePanelSession(): TuningSessionControls {
  const session = use(PanelSession);
  if (session === null) throw new Error('Panel parts must be rendered inside Panel.Root.');
  return session;
}
