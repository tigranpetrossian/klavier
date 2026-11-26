export type FontAxis = { tag: string; name: string; min: number; max: number; defaultValue: number };
export type FontFeature = { tag: string; name: string };
export type FontOption = { family: string; label: string; axes: readonly FontAxis[]; features: readonly FontFeature[] };
export type FontSettings = Readonly<Record<string, number>>;

type Setting = { tag: string; value: number };

const NORMAL = 'normal';
const DEFAULT_ON_FEATURES: ReadonlySet<string> = new Set(['liga', 'clig', 'calt', 'kern', 'rlig', 'ccmp', 'locl']);
const GENERIC_FAMILIES: ReadonlySet<string> = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  'inherit',
  'initial',
  'unset',
  'revert',
]);
const VARIATION_SETTING = /^(["'])([\x20-\x7e]{4})\1\s+([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)$/i;
const FEATURE_SETTING = /^(["'])([\x20-\x7e]{4})\1(?:\s+(\d+|on|off))?$/i;
const QUOTED_FAMILY = /^(["'])([\s\S]*)\1$/;
const UNQUOTED_FAMILY =
  /^-?[_a-z\u0080-\uffff][-_a-z0-9\u0080-\uffff]*(?:\s+-?[_a-z\u0080-\uffff][-_a-z0-9\u0080-\uffff]*)*$/i;
const WHITESPACE = /\s+/g;
const SETTING_DECIMALS = 3;

export function parseVariationSettings(css: string): FontSettings | null {
  return parseSettings(css, parseVariationSetting);
}

export function formatVariationSettings(settings: FontSettings): string {
  return formatSettings(settings);
}

export function parseFeatureSettings(css: string): FontSettings | null {
  return parseSettings(css, parseFeatureSetting);
}

export function formatFeatureSettings(settings: FontSettings): string {
  return formatSettings(settings);
}

export function featureEnabled(settings: FontSettings, tag: string): boolean {
  return (settings[tag] ?? (DEFAULT_ON_FEATURES.has(tag) ? 1 : 0)) > 0;
}

export function withFeature(settings: FontSettings, tag: string, enabled: boolean): FontSettings {
  const rest = Object.fromEntries(Object.entries(settings).filter(([entryTag]) => entryTag !== tag));
  return enabled === DEFAULT_ON_FEATURES.has(tag) ? rest : { ...rest, [tag]: enabled ? 1 : 0 };
}

export function fontFamilyOf(css: string): string | null {
  const [first] = splitTopLevel(css, ',');
  return first === undefined ? null : unquoteFamily(first.trim());
}

export function withFontFamily(css: string, family: string): string {
  const [, ...fallbacks] = splitTopLevel(css, ',');
  return [quoteFamily(family), ...fallbacks.map((fallback) => fallback.trim())].join(', ');
}

function parseSettings(css: string, parseSetting: (text: string) => Setting | null): FontSettings | null {
  const trimmed = css.trim();
  if (trimmed === '') return null;
  if (trimmed === NORMAL) return {};
  const settings: Record<string, number> = {};
  for (const part of splitTopLevel(trimmed, ',')) {
    const setting = parseSetting(part.trim());
    if (setting === null) return null;
    settings[setting.tag] = setting.value;
  }
  return settings;
}

function parseVariationSetting(text: string): Setting | null {
  const match = VARIATION_SETTING.exec(text);
  return match ? { tag: match[2], value: Number(match[3]) } : null;
}

function parseFeatureSetting(text: string): Setting | null {
  const match = FEATURE_SETTING.exec(text);
  if (!match) return null;
  return { tag: match[2], value: featureValue(match[3]) };
}

function featureValue(text: string | undefined): number {
  if (text === undefined || text.toLowerCase() === 'on') return 1;
  return text.toLowerCase() === 'off' ? 0 : Number(text);
}

function formatSettings(settings: FontSettings): string {
  const entries = Object.entries(settings);
  if (entries.length === 0) return NORMAL;
  return entries.map(([tag, value]) => `'${tag}' ${Number(value.toFixed(SETTING_DECIMALS))}`).join(', ');
}

function unquoteFamily(text: string): string | null {
  const quoted = QUOTED_FAMILY.exec(text);
  if (quoted) return quoted[2].replace(/\\(.)/g, '$1');
  return UNQUOTED_FAMILY.test(text) ? text.replace(WHITESPACE, ' ') : null;
}

function quoteFamily(family: string): string {
  return GENERIC_FAMILIES.has(family) ? family : `'${family.replace(/(['\\])/g, '\\$1')}'`;
}

function splitTopLevel(text: string, separator: string): string[] {
  if (text.trim() === '') return [];
  const parts: string[] = [];
  let quote: string | null = null;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '\\') index++;
    else if (quote !== null) quote = character === quote ? null : quote;
    else if (character === '"' || character === "'") quote = character;
    else if (character === separator) {
      parts.push(text.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}
