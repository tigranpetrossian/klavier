import type { SourceProblem } from '../shared/declarations-protocol';
import type { DeclarationModel, PropertyDeclaration } from './declaration-model';
import { reportError, reportWarning } from './problems';
import { referenceTarget } from './property-references';

export function reportSourceProblems(problems: readonly SourceProblem[]): void {
  for (const { file, reason } of problems)
    reportWarning(`Can't read ${file}: ${reason}. Its custom properties are not listed.`);
}

export function reportModelProblems(model: DeclarationModel): void {
  for (const { declaration, winner } of model.duplicates) {
    reportError(
      `Duplicate declaration '${declaration.id}'${at(declaration)}. The one${at(winner)} wins in the cascade, so only it is tunable.`
    );
  }
  for (const declaration of model.unplaced) {
    const conditions = declaration.source?.unsupported.join(', ') ?? '';
    reportWarning(
      `Can't find '${declaration.id}'${at(declaration)} on the page: the tuner doesn't understand ${conditions}.`
    );
  }
  for (const declaration of model.declarations) {
    const target = referenceTarget(declaration.defaultValue);
    if (target !== null && !model.byName.has(target)) {
      reportWarning(
        `'${declaration.id}'${at(declaration)} refers to ${target}, which is not declared. It resolves to nothing.`
      );
    }
  }
}

function at({ location }: PropertyDeclaration): string {
  return location === null ? '' : ` at ${location.file}:${location.line}`;
}
