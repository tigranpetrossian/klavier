import { createIcon } from 'figma-kit';

export const UndoIcon = createIcon({
  displayName: 'Undo',
  path: (
    <path
      fill="none"
      stroke="var(--color-icon)"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.5 7 6.5 10l3 3M6.5 10h7a3.5 3.5 0 0 1 0 7h-2"
    />
  ),
});

export const RedoIcon = createIcon({
  displayName: 'Redo',
  path: (
    <path
      fill="none"
      stroke="var(--color-icon)"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.5 7 17.5 10l-3 3M17.5 10h-7a3.5 3.5 0 0 0 0 7h2"
    />
  ),
});

export const AnimationIcon = createIcon({
  displayName: 'Animation',
  path: <path fill="none" stroke="var(--color-icon)" strokeLinecap="round" d="M6.5 17.5c5 0 6-11 11-11" />,
});
