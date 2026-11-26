import figmaKitTheme from 'figma-kit/dist/figma-development-theme.css?raw';
import figmaKitStyles from 'figma-kit/dist/styles.css?raw';
import animationFieldStyles from './styles/animation-field.css?raw';
import fieldStyles from './styles/fields.css?raw';
import panelPopoverStyles from './styles/panel-popover.css?raw';
import panelStyles from './styles/panel.css?raw';
import rowStyles from './styles/row.css?raw';
import sectionStyles from './styles/section.css?raw';
import shadowHostStyles from './styles/shadow-host.css?raw';

const DOCUMENT_ROOT_SELECTOR = /:root\b/g;
const SHADOW_HOST_SELECTOR = ':host';

let stylesheets: readonly CSSStyleSheet[] | null = null;

export function shadowStylesheets(): readonly CSSStyleSheet[] {
  stylesheets ??= [
    figmaKitTheme,
    figmaKitStyles,
    shadowHostStyles,
    panelStyles,
    sectionStyles,
    rowStyles,
    fieldStyles,
    panelPopoverStyles,
    animationFieldStyles,
  ].map(shadowStylesheet);
  return stylesheets;
}

function shadowStylesheet(css: string): CSSStyleSheet {
  const stylesheet = new CSSStyleSheet();
  stylesheet.replaceSync(css.replace(DOCUMENT_ROOT_SELECTOR, SHADOW_HOST_SELECTOR));
  return stylesheet;
}
