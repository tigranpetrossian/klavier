import { CheckmarkIcon, ChevronDownIcon, ChevronUpIcon, Select } from 'figma-kit';
import { useFieldName } from './row';

export type SelectOption<T extends string = string> = { value: T; label: string };

export type SelectFieldProps<T extends string> = {
  value: T;
  onValueChange(value: T): void;
  options: readonly SelectOption<T>[];
  disabled?: boolean;
  'aria-label'?: string;
};

export function SelectField<T extends string>(props: SelectFieldProps<T>) {
  const { value, onValueChange, options, disabled } = props;
  const name = useFieldName(props['aria-label']);
  const choose = (next: string | null) => {
    const option = options.find((candidate) => candidate.value === next);
    if (option === undefined) return;
    onValueChange(option.value);
  };
  return (
    <div className="tuner-SelectField">
      <Select.Root items={options} value={value} onValueChange={choose} disabled={disabled}>
        <Select.Trigger {...name}>
          <Select.Value className="tuner-SelectValue" />
          <Select.Icon>
            <ChevronDownIcon />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.ScrollUpArrow>
                <ChevronUpIcon />
              </Select.ScrollUpArrow>
              <Select.List>
                {options.map((option) => (
                  <Select.Item key={option.value} value={option.value}>
                    <Select.ItemIndicator>
                      <CheckmarkIcon size="4" />
                    </Select.ItemIndicator>
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
              <Select.ScrollDownArrow>
                <ChevronDownIcon />
              </Select.ScrollDownArrow>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
