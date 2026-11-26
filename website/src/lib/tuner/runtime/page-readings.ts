import type { DeclarationModel, PropertyDeclaration } from './declaration-model';
import { probePage, type PageProbe, type StyledBox } from './page-probe';
import type { PageDeclaration } from './page-styles';
import { formOf } from './property-references';
import { rawTypeOf, resolveDeclaration, typeOfSyntax, type Resolution } from './typed-values';
import type { PropertyType } from './value-types';

export type Placement = { readonly box: StyledBox; readonly claim: PageDeclaration };

export type PageReading = {
  placementOf(declaration: PropertyDeclaration): Placement | null;
  typeOf(declaration: PropertyDeclaration): PropertyType;
  resolutionOf(declaration: PropertyDeclaration): Resolution | null;
  targetInEffect(declaration: PropertyDeclaration, target: string): PropertyDeclaration | null;
  withChangedValues(): PageReading;
};

export type OwnWrites = <T>(write: () => T) => T;

export function readPage(model: DeclarationModel, ownWrites: OwnWrites): PageReading {
  let probe: PageProbe | null = null;
  return valueReading(model, () => (probe ??= probePage(model.page.declarations, [...model.owners.keys()])), ownWrites);
}

function valueReading(model: DeclarationModel, probe: () => PageProbe, ownWrites: OwnWrites): PageReading {
  const resolutions = new Map<PropertyDeclaration, Resolution | null>();

  const placementOf = (declaration: PropertyDeclaration): Placement | null => {
    const { placements } = probe();
    for (const claim of declaration.claims) {
      const box = placements.get(claim);
      if (box) return { box, claim };
    }
    return null;
  };

  const knownTypeOf = (declaration: PropertyDeclaration): PropertyType | null => {
    const syntax = model.page.syntaxes.get(declaration.name);
    if (syntax !== undefined) return typeOfSyntax(syntax);
    return formOf(declaration.defaultValue) === 'raw' ? rawTypeOf(declaration.defaultValue) : null;
  };

  const resolutionOf = (declaration: PropertyDeclaration): Resolution | null => {
    if (resolutions.has(declaration)) return resolutions.get(declaration) ?? null;
    const placement = placementOf(declaration);
    const resolution =
      placement &&
      ownWrites(() =>
        resolveDeclaration(placement.claim.style, placement.box, declaration.name, knownTypeOf(declaration))
      );
    resolutions.set(declaration, resolution);
    return resolution;
  };

  const targetInEffect = (declaration: PropertyDeclaration, target: string): PropertyDeclaration | null => {
    const placement = placementOf(declaration);
    if (placement === null) return null;
    const winner = probe().winnerOn(placement.box, target);
    return winner === null ? null : (model.owners.get(winner) ?? null);
  };

  return {
    placementOf,
    typeOf: (declaration) => knownTypeOf(declaration) ?? resolutionOf(declaration)?.type ?? 'text',
    resolutionOf,
    targetInEffect,
    withChangedValues: () => valueReading(model, probe, ownWrites),
  };
}
