import * as t from '@babel/types';
import type { ProjectModules } from './project-modules.ts';
import { bindingNames, classifyTopLevel, exportedName, readReactImports } from './top-level-declarations.ts';
import type { TransformScope } from './transform-scope.ts';

type ExportTarget = { kind: 'local'; name: string } | { kind: 'module'; file: string; name: string };

type ModuleExports = {
  readonly cells: ReadonlySet<string>;
  readonly named: ReadonlyMap<string, ExportTarget>;
  readonly stars: readonly string[];
};

export type CellResolver = (file: string, exportName: string) => string | null;

export function createCellResolver(scope: TransformScope, project: ProjectModules): CellResolver {
  const modules = new Map<string, ModuleExports | null>();
  return (file, exportName) => resolve(file, exportName, new Set());

  function resolve(file: string, exportName: string, visiting: ReadonlySet<string>): string | null {
    const visit = `${file}#${exportName}`;
    const exports = visiting.has(visit) ? null : exportsOf(file);
    if (!exports) return null;
    const next = new Set([...visiting, visit]);
    const target = exports.named.get(exportName);
    if (target?.kind === 'local') return exports.cells.has(target.name) ? cellKey(scope, file, target.name) : null;
    if (target?.kind === 'module') return resolve(target.file, target.name, next);
    if (exportName === 'default') return null;
    for (const star of exports.stars) {
      const key = resolve(star, exportName, next);
      if (key) return key;
    }
    return null;
  }

  function exportsOf(file: string): ModuleExports | null {
    if (!modules.has(file)) modules.set(file, readExports(file));
    return modules.get(file) ?? null;
  }

  function readExports(file: string): ModuleExports | null {
    if (!scope.isAppFile(file)) return null;
    const program = project.read(file);
    if (!program || hasDirective(program, 'use server')) return null;
    return collectExports(program, file, scope, project);
  }
}

export function cellKey(scope: TransformScope, file: string, binding: string): string {
  return `${scope.relative(file)}#${binding}`;
}

export function hasDirective(program: t.Program, value: string): boolean {
  return program.directives.some((directive) => directive.value.value === value);
}

function collectExports(
  program: t.Program,
  file: string,
  scope: TransformScope,
  project: ProjectModules
): ModuleExports {
  const topLevel = classifyTopLevel(program, readReactImports(program), (binding) => cellKey(scope, file, binding));
  const imports = importedBindings(program, file, project);
  const named = new Map<string, ExportTarget>();
  const stars: string[] = [];
  for (const statement of program.body) {
    if (t.isExportAllDeclaration(statement) && statement.exportKind !== 'type') {
      const target = project.resolve(statement.source.value, file);
      if (target) stars.push(target);
    } else if (t.isExportNamedDeclaration(statement) && statement.exportKind !== 'type') {
      for (const name of declaredNames(statement.declaration)) named.set(name, { kind: 'local', name });
      const source = statement.source ? project.resolve(statement.source.value, file) : null;
      for (const specifier of statement.specifiers) {
        if (!t.isExportSpecifier(specifier) || specifier.exportKind === 'type') continue;
        const local = exportedName(specifier.local);
        const exported = exportedName(specifier.exported);
        if (statement.source) {
          if (source) named.set(exported, { kind: 'module', file: source, name: local });
        } else {
          named.set(exported, imports.get(local) ?? { kind: 'local', name: local });
        }
      }
    }
  }
  return { cells: new Set(topLevel.cells.keys()), named, stars };
}

function importedBindings(program: t.Program, file: string, project: ProjectModules): Map<string, ExportTarget> {
  const bindings = new Map<string, ExportTarget>();
  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement) || statement.importKind === 'type') continue;
    const source = project.resolve(statement.source.value, file);
    if (!source) continue;
    for (const specifier of statement.specifiers) {
      if (t.isImportSpecifier(specifier)) {
        bindings.set(specifier.local.name, { kind: 'module', file: source, name: exportedName(specifier.imported) });
      }
    }
  }
  return bindings;
}

function declaredNames(declaration: t.Declaration | null | undefined): readonly string[] {
  if (t.isVariableDeclaration(declaration))
    return declaration.declarations.flatMap((declarator) => bindingNames(declarator.id));
  if (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration))
    return declaration.id ? [declaration.id.name] : [];
  return [];
}
