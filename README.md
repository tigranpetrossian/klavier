<div align="center">
  <img src="media/logo.png" width="248" height="156" alt="Klavier logo" />
</div>

<div align="center">
  <h1>Klavier</h1>
  <h3>A lightweight, customizable, interactive piano keyboard library built with React.</h3>
</div>

## Features

* Small - 4kB gzipped
* Fully customizable
* Keyboard, mouse, and touch support
* Can be used in both [controlled and uncontrolled mode](https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components)

## Getting started

```
npm install klavier
```

```tsx
import React from 'React'
import { Klavier } from 'klavier';

const App = () => {
  return <Klavier /> // render a default 88-key keyboard
}
```

## Props

| Prop                  | Default value    | Description                                                                                                             |
|-----------------------|------------------|-------------------------------------------------------------------------------------------------------------------------|
| `keyRange`            | `[21, 108]`      | The lowest and the highest notes of the piano in MIDI numbers (0-127).                                                  |
| `defaultActiveKeys`   | `[]`             | Keys that are pressed by default. Subsequent updates are ignored. Cleared when the user begins playing.                 |
| `activeKeys`          |                  | Currently pressed keys. Puts component into controlled mode; keys notes must be managed externally via callbacks.       |
| `onKeyPress`          |                  | Fired when a key is pressed.                                                                                            |
| `onKeyRelease`        |                  | Fired when a key is released.                                                                                           |
| `onChange`            |                  | Fired when active keys are changed via user input.                                                                      |
| `interactive`         | `true`           | Enable interaction with the piano via computer keyboard, mouse, or touch.                                               |
| `keymap`              | `DEFAULT_KEYMAP` | Mapping of computer keys to MIDI note numbers, e.g. `[{ key: 'q', midiNumber: 60 }, ..., { key: 'i', midiNumber: 72 }]` |
| `width`               | `"auto"`         | Width of the piano. Accepts any valid CSS value. When unspecified, the piano fills it's container and is responsive.    |
| `height`              | `"auto"`         | Height of the piano. Accepts any valid CSS value.                                                                       |
| `whiteKeyAspectRatio` | `"24 / 150"`     | Aspect ratio of the white key in CSS format. Ignored when `height` is specified.                                        |
| `blackKeyHeight`      | `"67.5%"`        | Height of the black key. Allows tweaking the appearance of black keys in relation to white keys.                        |
| `components`          |                  | Allows replacing default components for black and white keys and adding a custom label to each key.                     |

## Overview

Klavier is primarily a visual keyboard library. While it can be easily connected to a sound engine for playback, its 
primary purpose is displaying the current state of the keyboard at a given moment, and notifying the consumer about changes
to the states when keys are played or released.

## Interactivity

Klavier is interactive by default. It supports user input via computer keyboard, mouse, and touch.
Interactivity can be completely or partially disabled.

### Disabling interactivity
```tsx
<Klavier interactive={false} />
```

### Selective interactivity
`interactive` prop can be provided with an object to selectively enable/disable input, e.g. only allow input from mouse:
```tsx
<Klavier interactive={{ mouse: true }} />
```
**Note:** When using object notation, omitted properties are set to false.

## Customizing the size
By default, Klavier is responsive takes up the full width of its parent container. This can be changed by using a 
combination of `width`, `height`, and `blackKeyHeight` props. Those attributes accept any valid CSS values. 

### Fixed width:
```tsx
<Klavier width="50vw" />
```

### Fixed width and height:
```tsx
<Klavier width="800px" height="80px" />
```

### Reducing the height in responsive mode
Because height should be relative to the width of the keyboard, specifying a fixed height without a fixed width is not 
recommended, as it will the instrument to widen/shrink based on the viewport size. Instead, you can utilize the CSS 
`aspect-ratio` on the parent:
```tsx
<div style={{ aspectRatio: '8 / 1' }}>
  <Klavier width="100%" height="100%"/>
</div>
```

## Appearance

### Styling keys

Klavier intentionally ships with absolutely minimal styling. The appearance of the keyboard can be customized by specifying custom components for the black and white keys. 
This enables changing the look of the keyboard with the approach of your choice.

```tsx
const CustomBlackKey = ({ active, note }) => { return <div /> }
const CustomWhiteKey = ({ active, note }) => { return <div /> }

<Klavier components={{ blackKey: CustomBlackKey, whiteKey: CustomWhiteKey }} />
```

**Important:** avoid defining components directly in the prop object, as it can cause performance issues.

## Custom labels

`components` can also be used to render custom labels on keys, whether it's the octave number, pitch name, or a keyboard 
shortcut. As with keys, it requires a custom React component. The component will be injected with necessary note information.
```tsx
const CustomLabel = ({ active, note, midiC0, keyboardShortcut }) => {
  return // Your custom label
}

<Klavier components={{ label: CustomLabel }}
```
