import { useSyncExternalStore } from 'react';

export type ColorScheme = 'light' | 'dark';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';
const SERVER_COLOR_SCHEME: ColorScheme = 'light';

export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeToColorScheme, systemColorScheme, serverColorScheme);
}

function subscribeToColorScheme(listener: () => void): () => void {
  const query = window.matchMedia(DARK_SCHEME_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function systemColorScheme(): ColorScheme {
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? 'dark' : 'light';
}

function serverColorScheme(): ColorScheme {
  return SERVER_COLOR_SCHEME;
}
