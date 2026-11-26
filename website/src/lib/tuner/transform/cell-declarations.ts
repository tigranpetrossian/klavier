import * as t from '@babel/types';
import { MODULE_TOKEN, runtimeCall, withLoc } from './runtime-calls.ts';
import { bindingNames } from './top-level-declarations.ts';

const SETTER_VALUE = '__v';
const COMPOSITE_PREFIX = '__cells$';

export function wrapCells(
  program: t.Program,
  cells: ReadonlyMap<string, t.VariableDeclarator>,
  keyOf: (binding: string) => string,
  addPrefix: (statement: t.Statement, prefix: t.Statement) => void
): void {
  for (const statement of program.body) {
    const declaration = t.isExportNamedDeclaration(statement) ? statement.declaration : statement;
    if (!t.isVariableDeclaration(declaration)) continue;
    declaration.declarations = declaration.declarations.flatMap((declarator) => {
      const init = declarator.init;
      const names = bindingNames(declarator.id);
      if (!init || !names.some((name) => cells.get(name) === declarator)) return [declarator];
      declaration.kind = 'let';
      if (t.isIdentifier(declarator.id)) {
        declarator.init = withLoc(cellCall(declarator.id.name, init, assigningSetter(declarator.id.name)), init);
        return [declarator];
      }
      const composite = names.join(',');
      const compositeBinding = COMPOSITE_PREFIX + names.join('$');
      const compositeCell = cellCall(composite, init, t.arrowFunctionExpression([], t.blockStatement([])));
      addPrefix(
        statement,
        t.variableDeclaration('const', [t.variableDeclarator(t.identifier(compositeBinding), compositeCell)])
      );
      const source = runtimeCall('read', [t.stringLiteral(keyOf(composite)), t.identifier(compositeBinding)]);
      return names.map((name) =>
        t.variableDeclarator(
          t.identifier(name),
          cellCall(name, projection(declarator, source, name), assigningSetter(name))
        )
      );
    });
  }
}

function cellCall(
  name: string,
  body: t.Expression | t.BlockStatement,
  setter: t.ArrowFunctionExpression
): t.CallExpression {
  return runtimeCall('cell', [
    t.identifier(MODULE_TOKEN),
    t.stringLiteral(name),
    t.arrowFunctionExpression([], body),
    setter,
  ]);
}

function assigningSetter(name: string): t.ArrowFunctionExpression {
  return t.arrowFunctionExpression(
    [t.identifier(SETTER_VALUE)],
    t.blockStatement([
      t.expressionStatement(t.assignmentExpression('=', t.identifier(name), t.identifier(SETTER_VALUE))),
    ])
  );
}

function projection(declarator: t.VariableDeclarator, source: t.Expression, name: string): t.BlockStatement {
  const pattern = t.cloneNode(declarator.id, true);
  return t.blockStatement([
    t.variableDeclaration('const', [t.variableDeclarator(pattern, t.cloneNode(source, true))]),
    t.returnStatement(t.identifier(name)),
  ]);
}
