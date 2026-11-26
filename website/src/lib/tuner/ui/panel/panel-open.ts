import { useCallback, useState, useSyncExternalStore } from 'react';

const PANEL_OPEN_KEY = 'tuner:panel-open';

export function usePanelOpen(): [open: boolean, setOpen: (open: boolean) => void] {
  const storedOpen = useSyncExternalStore(subscribeToNothing, readStoredOpen, closedOnServer);
  const [chosenOpen, setChosenOpen] = useState<boolean | null>(null);
  const setOpen = useCallback((open: boolean) => {
    setChosenOpen(open);
    writeStoredOpen(open);
  }, []);
  return [chosenOpen ?? storedOpen, setOpen];
}

function readStoredOpen(): boolean {
  return ignoringFailures(() => sessionStorage.getItem(PANEL_OPEN_KEY) === 'true', false);
}

function writeStoredOpen(open: boolean): void {
  ignoringFailures(() => sessionStorage.setItem(PANEL_OPEN_KEY, String(open)), undefined);
}

function subscribeToNothing(): () => void {
  return () => {};
}

function closedOnServer(): boolean {
  return false;
}

function ignoringFailures<T>(run: () => T, fallback: T): T {
  try {
    return run();
  } catch {
    return fallback;
  }
}
