# Tuner

A dev-only tool for tuning the website live: constants in code and CSS custom properties are edited from a panel and saved back to source. Nothing of it reaches production builds.

## Rules

- **Treat the tuner as a separate library.** It lives in `src/lib/tuner` and will be extracted into its own package. Keep it generic: it must never import from the website or know about its content, pages, components or styles.
- **Website-specific code lives outside it.** The site's panel is in `src/dev-tools/tuner-panel`, built from the tuner's primitives.
- **Dev only.** The website loads the panel through a dynamic import behind `process.env.NODE_ENV === 'development'`, so production builds never bundle it. Keep it that way.

## API

### `@/lib/tuner/tunable`

- `tunable(id, value)` marks a constant as tunable and returns its value. In production it just returns `value`.
- `Color` is the type for tunable color strings (hex, `rgb()`, `hsl()`, `oklch()`).

```ts
export const GAP = tunable('layout.gap', 16);
```

CSS custom properties need no marker. Every declaration in the site's stylesheets is tunable.

### `@/lib/tuner/react`

- `useTuningSession({ storage })` starts the tuner while mounted. It returns `undo`, `redo`, `commitUndo`, `resetAll`, `save`, plus `undoIds`, `redoIds`, `changedCount` and `saveState`. `storage` defaults to `createBrowserStorage()`. `Panel.Root` calls it.
- `useTunable(id, check, fallback)` reads and edits one constant.
- `useProperty(name, { context, codec })` reads and edits one custom property. `context` defaults to `:root`. Without a `codec`, the value is the declaration's CSS text.
- `useTunables()` lists every tunable value.

Both hooks return a control whose props are a field's props: `value`, `defaultValue`, `changed`, `disabled`, `onValueChange(value)`, `onPreviewChange(value | null)` and `onReset()`. Spread it into a field and a `ResetButton`. The raw entry is under `entry`. A property control also has `targets`, `pointTo(name)` and `detach()`.

```tsx
const PX = cssNumber('px');

function TitleSize() {
  const size = useProperty('--title-size', { codec: PX });
  return <SliderField {...size} min={10} max={40} />;
}
```

- When the id isn't registered, `check` rejects the value, or no declaration has that name and context, the hook still returns a control. It is disabled: `entry` is `null`, `value` and `defaultValue` are the `fallback` or the codec's `empty`, and its handlers do nothing.
- `onValueChange` and `onPreviewChange` return `false` when they reject a value.
- A preview shows a value on the page without editing it: the value, `changed`, history and storage stay as they were. `onPreviewChange(null)` ends it, and so does setting or resetting the value.

Fields know nothing about undo. The session groups edits into steps at input boundaries, the way Figma does:

- A pointerdown closes the open step. A drag is one step, even with a pause in it, and two drags are two steps.
- A keydown closes the open step too, except for a modifier key, and for a nudge key (an arrow, PageUp, PageDown, Home or End) right after another nudge. Separate arrow presses on one field are one step until a click or another key, and so is a held key. A value typed and committed with Enter is its own step.
- An edit a field makes as it loses focus closes its own step. A value typed and committed by a click elsewhere stays apart from the edit that click makes.
- Leaving the page closes the open step.
- Nothing else does: not pointerup, keyup, focus or a pause. A change a field makes on release joins its drag.
- An edit of another value always starts a new step. `commitUndo()` closes the open step for edits made from code.

### `@/lib/tuner/animation`

Safe to import from site code: it has no UI and no runtime.

```ts
type Animation =
  | { type: 'spring'; stiffness: number; damping: number; mass: number; delay: number }
  | { type: 'time'; duration: number; bounce: number; delay: number }
  | { type: 'easing'; duration: number; bezier: [number, number, number, number]; delay: number };

export const ENTER_ANIMATION = tunable<Animation>('page.enter', {
  type: 'spring',
  stiffness: 112,
  damping: 24,
  mass: 1,
  delay: 0,
});
element.style.transition = animationTransition(ENTER_ANIMATION, 'opacity');
```

Times are in milliseconds. `time` is a spring given by a duration and a bounce (0 to 1), the way Motion's `visualDuration` and `bounce` give one: without bounce it is about 97% of the way after its duration. A spring settles once it stays within 0.5% of its end, however long that takes. A spring whose stiffness, damping or mass is 0 or less never settles, so it doesn't animate.

- `isAnimation(value)`: the check for `useTunable`.
- `animationTransition(animation, property = 'all')`: a CSS `transition` value. Springs become a `linear()` curve that runs until they settle.
- `animationEasing(animation)`, `animationDuration(animation)`: the timing function and duration of that transition.
- `animationProgress(animation, ms)`: progress `ms` after the start. It is 0 before the start and 1 once the duration has passed.
- `summarizeAnimation(animation)`: `Spring · 112 | 24 | 1`, `Duration · 200ms | 0.15`, `Ease · cubic-bezier(.17,.67,.83,.67)`, plus ` · 80ms delay` when there is a delay.
- `sampleAnimation(animation, count)`: progress at `count` even steps of the duration, or at more steps when a spring oscillates too fast for `count` to follow it. `animationEasing` samples the same way, so a `linear()` curve keeps every peak.
- `convertAnimation(animation, type)`: the closest animation of another type.

### `@/lib/tuner/ui`

The tuner's UI components, styled with figma-kit and rendered in a shadow root. It also re-exports everything figma-kit exports, icons included. Popups opened from inside `Panel.Drawer` render in its shadow root.

#### `Panel`

The right-side drawer that holds the tuner. `Panel.Root` does all the wiring (session, open state, shortcuts); the other parts only lay the panel out.

#### `Section`

A block with a header and a body. Each part accepts every prop of the element it renders.

- `Section.Root`: the block. Add `collapsible` to make it fold. A collapsible root also takes `defaultOpen` (default `true`), `open` and `onOpenChange`.
- `Section.Header`: takes any content, such as actions next to the title. Actions line up with the rail.
- `Section.Title`: the header's title.
- `Section.Trigger`: folds a collapsible section. Put it in the header, wrapping the title.
- `Section.Body`: the section's rows, 8px apart.

#### `Row`

One line of fields on Figma's grid: 16px on the left, two field columns, and a 40px rail on the right. Each part accepts every prop of the element it renders.

- `Row.Root`: the line. `inline` puts each label to the left of its field instead of above it, for compact lists such as popovers.
- `Row.Field`: one column. `span={2}` takes both.
- `Row.Label`: the field's label. It names the controls in its field.
- `Row.Rail`: the rail cell, for one icon button.

```tsx
<Row.Root>
  <Row.Field span={2}>
    <Row.Label>Size</Row.Label>
    <SliderField {...size} min={10} max={40} />
  </Row.Field>
  <Row.Rail>
    <ResetButton {...size} />
  </Row.Rail>
</Row.Root>
```

#### `ResetButton`

An undo icon button for the rail. It shows only while `changed`. Props: `changed`, `onReset`, `label` (default `Reset`).

#### Fields

Controlled fields. Each takes `value` and `onValueChange(value)`, plus `disabled` and `aria-label` (a field inside `Row.Field` takes its name from `Row.Label`). A field calls `onValueChange` on every change and never touches undo history.

- `SliderField`: a slider joined to a number input. Props: `min`, `max`, `step` (default 1), `scale`, `precision`, `suffix`, `icon` (shown after the number), `onReset` (runs on a double click of the thumb). A range from below 0 to above 0 fills from 0.
- `NumberField`: a number input that scrubs. Props: `min`, `max`, `step`, `scale`, `precision`, `suffix`, `icon` (a letter or an icon that is the drag handle). `scale` multiplies the value for display, so `0.008` with `scale={100}` and `suffix="%"` shows `0.8%`. `precision` defaults to the decimals of `step * scale`.
- `NumericSelectField`: a number input with a list of `options`. `onPreviewChange(value | null)` reports the highlighted option and `null` when the list closes.
- `SelectField`: one of `options: { value, label }[]`.
- `SegmentedField`: one of `options: { value, label, icon? }[]`, side by side. An option with an icon shows the icon and `label` as its tooltip.
- `SwitchField`: a switch with `label` and an optional `detail` after it.
- `TextField`: text that changes on Enter or blur. Escape drops the edit.
- `ColorField`: a swatch, hex and opacity for any CSS color string. The swatch opens a color picker beside the panel. It writes in the format of `value` (`hex`, `rgb`, `hsl`, `oklch`), and in hex for any other color.

#### `PanelPopover`

A popover that opens against the panel's left edge with no gap, level with its trigger, like Figma's side-panel popovers. One opened from inside another opens against that popover's left edge, level with its top.

- `PanelPopover.Root`: takes figma-kit `Popover.Root` props.
- `PanelPopover.Trigger`: the element it opens from. Pass `render` to use a component, such as `render={<IconButton aria-label="…" />}`.
- `PanelPopover.Toggle`: a ready-made trigger with an icon, a label and a summary line. Props: `icon`, `label`, `summary`, `disabled`.
- `PanelPopover.Popup`: the surface, 240px wide.
- `PanelPopover.Header`, `PanelPopover.Title`, `PanelPopover.Controls`, `PanelPopover.Close`: the header.
- `PanelPopover.Body`: a padded column of rows.

#### `FontPicker`

A searchable list of fonts. Props: `fonts: FontOption[]`, `value` (a family name), `onValueChange(family)`, `onPreviewChange(family | null)`, `disabled`. Each highlighted font is previewed, and closing the list without a choice ends the preview. A `value` that isn't in `fonts` shows as its own item. A property control with the `FONT_FAMILY` codec fits it as is.

```ts
type FontAxis = { tag: string; name: string; min: number; max: number; defaultValue: number };
type FontFeature = { tag: string; name: string };
type FontOption = { family: string; label: string; axes: readonly FontAxis[]; features: readonly FontFeature[] };
type FontSettings = Readonly<Record<string, number>>;
```

#### `TypeSettings`

A rail button that opens a popover with two tabs: a slider per variable axis of `font`, and a switch per OpenType feature. Props: `font: FontOption | undefined`, `axes` and `features`, each `{ value: FontSettings, onValueChange(value: FontSettings), disabled? }`, and `label` (default `Type settings`). An axis value is a number, and a feature value is on or off. Each row writes the whole settings with its own tag changed, so a property control with the `VARIATION_SETTINGS` or `FEATURE_SETTINGS` codec fits as is.

To edit `wght` through its own property, merge it into `axes`:

```tsx
const NUMBER = cssNumber();

const weight = useProperty('--body-weight', { context: 'body', codec: NUMBER });
const variation = useProperty('--body-axes', { context: 'body', codec: VARIATION_SETTINGS });
const axes = {
  value: { ...variation.value, wght: weight.value },
  onValueChange: ({ wght = weight.value, ...rest }: FontSettings) => {
    if (wght === weight.value) variation.onValueChange(rest);
    else weight.onValueChange(wght);
  },
  disabled: variation.disabled,
};
```

#### `AnimationField`

A toggle with an icon, the label and `summarizeAnimation(value)`. It opens an editor beside the panel: Easing, Time and Spring tabs, the curve in a 256 by 128 box with its settle time, and a field per number. Props: `label`, `value: Animation`, `onValueChange`, `defaultValue` (a double click on a thumb resets that number to it), `icon`, `disabled`. A constant control from `useTunable(id, isAnimation, fallback)` fits it as is: `<AnimationField {...enter} label="Enter" />`.

- Switching tabs converts the value, and switching back restores what was edited there. A converted value is fitted to the ranges of the fields: a spring is scaled to the same motion, and a time animation lasts at least 100ms.
- Time and Spring draw the first two seconds of the spring, so a slower spring rises more slowly and one that needs longer stops short of its end.
- Easing has curve presets and two handles. The curve is drawn in a square in the middle of the box. A handle drags sideways between the ends of the curve, and up to 2 and down to -1. The graph zooms out to keep a handle in the box.

#### Codecs

A codec tells `useProperty` how to read and write a declaration's CSS text. The control's `value` is the first of the declaration's value, its resolution and its default that the codec reads, or the codec's `empty`. An edit writes `format(value, current)`, where `current` is the declaration's text now, so a codec can keep what it doesn't edit, such as font fallbacks. Keep each codec in a module constant, because the hook memoizes the control on it. The `PropertyCodec<T>` type comes from `@/lib/tuner/react`.

- `cssNumber(unit = '')`: a number written as `<number><unit>`, such as `18px`, `0.008em` or `480`. A value in another unit, a reference or an expression shows its resolution, or the default. An edit writes a plain number.
- `CSS_COLOR`: a color. A reference shows the color it resolves to. An edit of a reference or an expression replaces it with a hex color, and an edit of a color writes the new color as is.
- `FONT_FAMILY`: the first family of a `font-family` list. Choosing writes it quoted and keeps the fallbacks.
- `VARIATION_SETTINGS`, `FEATURE_SETTINGS`: `font-variation-settings` and `font-feature-settings` as `FontSettings`, for `TypeSettings`. Their `empty` is `{}`.

#### CSS values

- `parseCssNumber(text, unit = '')`, `formatCssNumber(value, unit = '')`: `18px` to `18` and back. A bare `0` reads as 0 in any unit.
- `parseVariationSettings(css)`, `parseFeatureSettings(css)`: `font-variation-settings` and `font-feature-settings` text to `FontSettings`, or `null` when it can't be read. `normal` is `{}`.
- `formatVariationSettings(settings)`, `formatFeatureSettings(settings)`: back to text, `normal` when empty.
- `featureEnabled(settings, tag)`: `liga`, `clig`, `calt`, `kern`, `rlig`, `ccmp` and `locl` are on unless set to 0. Others are off unless set.
- `withFeature(settings, tag, enabled)`: drops the tag when `enabled` is its default, and sets 1 or 0 otherwise.
- `fontFamilyOf(css)`, `withFontFamily(css, family)`: read and replace the first family of a `font-family` list.

#### Icons

- `UndoIcon`, `RedoIcon`, `AnimationIcon`, and every figma-kit icon.

#### `TUNER_SCOPE_CLASS_NAME`

The class that marks the tuner's own surfaces. The panel's shortcuts, such as undo and redo, do nothing while a text field on the page has focus, unless the field is inside an element with this class. Put it around a field of yours that renders on the page, so the shortcuts work in it. It carries no styles outside the panel.

### `@/lib/tuner/color`

`parseColor`, `convertColor` and `formatColor` convert colors between hex, rgb, hsl and oklch.

### `@/lib/tuner/next`

`withTuner(config, { exclude })` wraps `next.config`. `exclude` lists directories the tuner must not instrument, such as `src/dev-tools`.
