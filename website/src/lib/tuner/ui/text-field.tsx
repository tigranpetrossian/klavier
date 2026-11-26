import { Input } from 'figma-kit';
import { useState, type KeyboardEvent } from 'react';
import { useFieldName } from './row';

export type TextFieldProps = {
  value: string;
  onValueChange(value: string): void;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
};

export function TextField({ value, onValueChange, placeholder, disabled, ...props }: TextFieldProps) {
  const name = useFieldName(props['aria-label']);
  const [draft, setDraft] = useState<string | null>(null);
  const submit = () => {
    setDraft(null);
    if (draft === null || draft === value) return;
    onValueChange(draft);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    setDraft(null);
    const input = event.currentTarget;
    requestAnimationFrame(() => input.blur());
  };
  return (
    <Input
      {...name}
      className="tuner-TextField"
      value={draft ?? value}
      placeholder={placeholder}
      disabled={disabled}
      spellCheck={false}
      autoComplete="off"
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={submit}
    />
  );
}
