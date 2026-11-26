import { CheckmarkIcon, ChevronDownIcon, Combobox } from 'figma-kit';
import { useMemo, useRef, type CSSProperties } from 'react';
import { withFontFamily, type FontOption } from './font-settings';
import { useFieldName } from './row';

export type FontPickerProps = {
  fonts: readonly FontOption[];
  value: string;
  onValueChange(family: string): void;
  onPreviewChange?(family: string | null): void;
  disabled?: boolean;
  'aria-label'?: string;
};

const SEARCH_LABEL = 'Search fonts';
const SELECTED_ITEM = '[data-selected]';
const EMPTY_MESSAGE = 'No fonts found.';

export function FontPicker(props: FontPickerProps) {
  const { fonts, value, onValueChange, onPreviewChange, disabled } = props;
  const name = useFieldName(props['aria-label']);
  const { selected, items } = useMemo(() => fontItems(fonts, value), [fonts, value]);
  const list = useRef<HTMLDivElement>(null);
  const choose = (font: FontOption | null) => {
    if (font === null) return;
    onValueChange(font.family);
    onPreviewChange?.(null);
  };
  return (
    <div className="tuner-FontPicker">
      <Combobox.Root
        items={items}
        value={selected}
        onValueChange={choose}
        isItemEqualToValue={sameFamily}
        onItemHighlighted={(font) => onPreviewChange?.(font?.family ?? null)}
        onOpenChange={(open) => {
          if (!open) onPreviewChange?.(null);
        }}
        onOpenChangeComplete={(open) => {
          if (open) revealSelected(list.current);
        }}
        disabled={disabled}
      >
        <Combobox.Trigger {...name}>
          <Combobox.Value />
          <Combobox.Icon>
            <ChevronDownIcon />
          </Combobox.Icon>
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup className="tuner-FontPickerPopup">
              <Combobox.InputGroup>
                <Combobox.SearchInput aria-label={SEARCH_LABEL} placeholder={SEARCH_LABEL} />
              </Combobox.InputGroup>
              <Combobox.Empty>{EMPTY_MESSAGE}</Combobox.Empty>
              <Combobox.List ref={list}>
                {(font: FontOption) => (
                  <Combobox.Item key={font.family} value={font}>
                    <Combobox.ItemIndicator>
                      <CheckmarkIcon size="4" />
                    </Combobox.ItemIndicator>
                    <span className="tuner-FontPickerPreview" style={fontFace(font)}>
                      {font.label}
                    </span>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </div>
  );
}

function revealSelected(list: HTMLElement | null): void {
  list?.querySelector(SELECTED_ITEM)?.scrollIntoView({ block: 'nearest' });
}

function fontItems(fonts: readonly FontOption[], family: string) {
  const listed = fonts.find((font) => font.family === family);
  if (listed !== undefined) return { selected: listed, items: fonts };
  const unlisted: FontOption = { family, label: family, axes: [], features: [] };
  return { selected: unlisted, items: [unlisted, ...fonts] };
}

function sameFamily(item: FontOption, value: FontOption): boolean {
  return item.family === value.family;
}

function fontFace(font: FontOption): CSSProperties {
  return { fontFamily: withFontFamily('', font.family) };
}
