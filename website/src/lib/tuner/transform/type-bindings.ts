import * as t from '@babel/types';
import type { ProjectModules } from './project-modules.ts';
import { exportedName } from './top-level-declarations.ts';
import { TUNABLE_FILE } from './transform-scope.ts';
import path from 'node:path';

export type TypeBinding =
  | { readonly kind: 'alias'; readonly file: string; readonly type: t.TSType }
  | { readonly kind: 'interface'; readonly file: string; readonly declarations: readonly t.TSInterfaceDeclaration[] }
  | { readonly kind: 'namespace'; readonly file: string }
  | { readonly kind: 'generic' | 'class' | 'color' };

export type TypeBindings = {
  lookup(file: string, name: readonly string[]): TypeBinding | null;
};

type LocalType = TypeBinding | { readonly kind: 'import'; readonly file: string; readonly name: string };

type TypeExport =
  | { readonly kind: 'local'; readonly name: string }
  | { readonly kind: 'module'; readonly file: string; readonly name: string }
  | { readonly kind: 'namespace'; readonly file: string };

type ModuleTypes = {
  readonly locals: ReadonlyMap<string, LocalType>;
  readonly exports: ReadonlyMap<string, TypeExport>;
  readonly stars: readonly string[];
};

const COLOR_EXPORT = 'Color';
const THIRD_PARTY_DIRECTORY = 'node_modules';

export function createTypeBindings(project: ProjectModules, file: string, program: t.Program): TypeBindings {
  const modules = new Map<string, ModuleTypes | null>([[file, collectModuleTypes(program, file, project)]]);
  return {
    lookup(from, [head, ...rest]) {
      let binding = follow(typesOf(from)?.locals.get(head), new Set());
      for (const segment of rest) {
        binding = binding?.kind === 'namespace' ? resolveExport(binding.file, segment, new Set()) : null;
      }
      return binding;
    },
  };

  function resolveExport(file: string, name: string, visiting: ReadonlySet<string>): TypeBinding | null {
    if (file === TUNABLE_FILE) return name === COLOR_EXPORT ? { kind: 'color' } : null;
    const visit = `${file}#${name}`;
    const types = visiting.has(visit) ? null : typesOf(file);
    if (!types) return null;
    const next = new Set([...visiting, visit]);
    const target = types.exports.get(name);
    if (target?.kind === 'local') return follow(types.locals.get(target.name), next);
    if (target?.kind === 'module') return resolveExport(target.file, target.name, next);
    if (target?.kind === 'namespace') return target;
    for (const star of types.stars) {
      const binding = resolveExport(star, name, next);
      if (binding) return binding;
    }
    return null;
  }

  function follow(local: LocalType | undefined, visiting: ReadonlySet<string>): TypeBinding | null {
    if (!local) return null;
    return local.kind === 'import' ? resolveExport(local.file, local.name, visiting) : local;
  }

  function typesOf(file: string): ModuleTypes | null {
    if (!modules.has(file)) modules.set(file, readModuleTypes(file));
    return modules.get(file) ?? null;
  }

  function readModuleTypes(file: string): ModuleTypes | null {
    if (file.split(path.sep).includes(THIRD_PARTY_DIRECTORY)) return null;
    const program = project.read(file);
    return program && collectModuleTypes(program, file, project);
  }
}

function collectModuleTypes(program: t.Program, file: string, project: ProjectModules): ModuleTypes {
  const locals = new Map<string, LocalType>();
  const interfaces = new Map<string, t.TSInterfaceDeclaration[]>();
  const exports = new Map<string, TypeExport>();
  const stars: string[] = [];
  const resolve = (source: t.StringLiteral) => project.resolve(source.value, file);
  for (const statement of program.body) {
    if (t.isImportDeclaration(statement)) {
      const source = resolve(statement.source);
      if (source) for (const specifier of statement.specifiers) addImport(specifier, source);
    } else if (t.isExportAllDeclaration(statement)) {
      const source = resolve(statement.source);
      if (source) stars.push(source);
    } else if (t.isExportNamedDeclaration(statement)) {
      const name = declare(statement.declaration);
      if (name !== null) exports.set(name, { kind: 'local', name });
      const source = statement.source ? resolve(statement.source) : null;
      if (!statement.source || source) for (const specifier of statement.specifiers) addExport(specifier, source);
    } else {
      declare(statement);
    }
  }
  for (const [name, declarations] of interfaces) locals.set(name, { kind: 'interface', file, declarations });
  return { locals, exports, stars };

  function declare(declaration: t.Node | null | undefined): string | null {
    if (t.isTSTypeAliasDeclaration(declaration)) {
      const generic = Boolean(declaration.typeParameters);
      locals.set(
        declaration.id.name,
        generic ? { kind: 'generic' } : { kind: 'alias', file, type: declaration.typeAnnotation }
      );
      return declaration.id.name;
    }
    if (t.isTSInterfaceDeclaration(declaration)) {
      if (declaration.typeParameters) locals.set(declaration.id.name, { kind: 'generic' });
      else interfaces.set(declaration.id.name, [...(interfaces.get(declaration.id.name) ?? []), declaration]);
      return declaration.id.name;
    }
    if (t.isClassDeclaration(declaration) && declaration.id) {
      locals.set(declaration.id.name, { kind: 'class' });
      return declaration.id.name;
    }
    return null;
  }

  function addImport(specifier: t.ImportDeclaration['specifiers'][number], source: string): void {
    if (t.isImportNamespaceSpecifier(specifier)) locals.set(specifier.local.name, { kind: 'namespace', file: source });
    if (t.isImportSpecifier(specifier)) {
      locals.set(specifier.local.name, { kind: 'import', file: source, name: exportedName(specifier.imported) });
    }
  }

  function addExport(specifier: t.ExportNamedDeclaration['specifiers'][number], source: string | null): void {
    const exported = exportedName(specifier.exported);
    if (t.isExportNamespaceSpecifier(specifier)) {
      if (source) exports.set(exported, { kind: 'namespace', file: source });
    } else if (t.isExportSpecifier(specifier)) {
      const local = exportedName(specifier.local);
      exports.set(exported, source ? { kind: 'module', file: source, name: local } : { kind: 'local', name: local });
    }
  }
}
