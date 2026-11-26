import { Button, IconButton } from 'figma-kit';
import type { TuningSessionControls } from '../../react';
import { RedoIcon, UndoIcon } from '../icons';
import { usePanelSession } from './panel-session';

export function Undo() {
  const { undoIds, undo } = usePanelSession();
  return (
    <IconButton aria-label="Undo" size="small" disabled={undoIds === null} onClick={undo}>
      <UndoIcon size="6" />
    </IconButton>
  );
}

export function Redo() {
  const { redoIds, redo } = usePanelSession();
  return (
    <IconButton aria-label="Redo" size="small" disabled={redoIds === null} onClick={redo}>
      <RedoIcon size="6" />
    </IconButton>
  );
}

export function Reset() {
  const { changedCount, resetAll } = usePanelSession();
  return (
    <Button variant="text" size="small" disabled={changedCount === 0} onClick={resetAll}>
      Reset
    </Button>
  );
}

export function Save() {
  const session = usePanelSession();
  return (
    <Button variant="primary" size="small" disabled={!canSave(session)} onClick={() => void session.save()}>
      Save
    </Button>
  );
}

function canSave({ changedCount, saveState }: TuningSessionControls): boolean {
  return changedCount > 0 && saveState.status !== 'saving';
}
