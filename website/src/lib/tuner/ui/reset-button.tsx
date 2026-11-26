import { IconButton, Tooltip } from 'figma-kit';
import { UndoIcon } from './icons';

type ResetButtonProps = { changed: boolean; onReset(): void; label?: string };

const DEFAULT_LABEL = 'Reset';

export function ResetButton({ changed, onReset, label = DEFAULT_LABEL }: ResetButtonProps) {
  return (
    <Tooltip content={label}>
      <IconButton
        aria-label={label}
        size="small"
        className="tuner-ResetButton"
        data-unchanged={changed ? undefined : ''}
        disabled={!changed}
        onClick={() => onReset()}
      >
        <UndoIcon size="6" />
      </IconButton>
    </Tooltip>
  );
}
