import type { PropertyDeclaration } from './declaration-model';
import type { PageDeclaration } from './page-styles';

type ServedValue = { readonly value: string; readonly priority: string; readonly sourceDefault: string };

const servedValues = new WeakMap<CSSStyleDeclaration, Map<string, ServedValue>>();

export function showOnPage(declaration: PropertyDeclaration, value: string): void {
  for (const claim of declaration.claims) {
    if (value === declaration.defaultValue) restoreClaim(claim, declaration);
    else writeClaim(claim, declaration, value);
  }
}

function writeClaim(claim: PageDeclaration, declaration: PropertyDeclaration, value: string): void {
  const byName = servedValues.get(claim.style) ?? new Map<string, ServedValue>();
  servedValues.set(claim.style, byName);
  const served = byName.get(claim.name) ?? {
    value: claim.style.getPropertyValue(claim.name),
    priority: claim.style.getPropertyPriority(claim.name),
    sourceDefault: declaration.defaultValue,
  };
  byName.set(claim.name, served);
  claim.style.setProperty(claim.name, value, served.priority);
}

function restoreClaim(claim: PageDeclaration, declaration: PropertyDeclaration): void {
  const served = servedValues.get(claim.style)?.get(claim.name);
  if (!served) return;
  // After a save, Tailwind's entry stylesheet can hot-reload one edit late, so a changed source default beats the served text.
  const value = served.sourceDefault === declaration.defaultValue ? served.value : declaration.defaultValue;
  claim.style.setProperty(claim.name, value, served.priority);
}
