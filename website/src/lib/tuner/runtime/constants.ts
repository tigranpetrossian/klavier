import type { ConstantType, TypeInfo } from '../shared/constant-type';
import { defineCell, defineSource, readSource, writeSource } from './graph';
import { deepEqual, isPlainData } from './plain-data';
import { reportError, reportWarning } from './problems';
import { registerValues, unregisterValues, type SaveCandidate, type ValueAdapter } from './session-store';
import { colorModelOf, fitsType, inferType, literalOptions } from './type-checks';
import type { SourceLocation } from './value-types';

export type ModuleToken = { readonly file: string; readonly evaluation: number };

type CallSite = { readonly token: ModuleToken; readonly line: number };

type Claim = CallSite & { readonly defaultValue: unknown; readonly typeInfo: TypeInfo; readonly tuned: boolean };

type ClaimRelation =
  { kind: 'unclaimed' | 'newer-evaluation' } | { kind: 'same-site' | 'older-evaluation' | 'duplicate'; claim: Claim };

type TypeResolution = { ok: true; type: ConstantType } | { ok: false; problem: string };

const SKIP_REASONS = {
  value: 'The value is not plain data, so it cannot be written into source',
  default: 'The default is not plain data, so it cannot be found in source',
};

const evaluations = new Map<string, number>();
const claims = new Map<string, Claim>();

export function moduleToken(file: string): ModuleToken {
  const evaluation = (evaluations.get(file) ?? 0) + 1;
  evaluations.set(file, evaluation);
  return { file, evaluation };
}

export function cell(token: ModuleToken, name: string, init: () => unknown, setter: (value: unknown) => void): unknown {
  return defineCell(`${token.file}#${name}`, init, setter);
}

export function tunable(
  token: ModuleToken,
  id: string,
  defaultValue: unknown,
  typeInfo: TypeInfo,
  line: number
): unknown {
  const site: CallSite = { token, line };
  const relation = relationTo(claims.get(id), site);
  switch (relation.kind) {
    case 'unclaimed':
    case 'newer-evaluation':
      return claimId(site, id, defaultValue, typeInfo);
    case 'same-site':
      return isUnchanged(relation.claim, defaultValue, typeInfo)
        ? currentValue(relation.claim, id, defaultValue)
        : claimId(site, id, defaultValue, typeInfo);
    case 'older-evaluation':
      return currentValue(relation.claim, id, defaultValue);
    case 'duplicate':
      reportError(`Duplicate id '${id}' at ${describe(site)}. ${describe(relation.claim)} keeps it.`);
      return defaultValue;
  }
}

function relationTo(claim: Claim | undefined, site: CallSite): ClaimRelation {
  if (!claim) return { kind: 'unclaimed' };
  if (claim.token === site.token) return { kind: claim.line === site.line ? 'same-site' : 'duplicate', claim };
  if (claim.token.file !== site.token.file) return { kind: 'duplicate', claim };
  return site.token.evaluation > claim.token.evaluation
    ? { kind: 'newer-evaluation' }
    : { kind: 'older-evaluation', claim };
}

function claimId(site: CallSite, id: string, defaultValue: unknown, typeInfo: TypeInfo): unknown {
  const checked = checkConstant(id, site, defaultValue, typeInfo);
  claims.set(id, { ...site, defaultValue, typeInfo, tuned: checked.ok });
  if (!checked.ok) {
    reportError(`${checked.problem} Tuning is off.`);
    unregisterValues([id]);
    return defaultValue;
  }
  defineSource(id, defaultValue);
  registerValues([constantAdapter(id, defaultValue, checked.type, locationOf(site))]);
  return readSource(id);
}

function checkConstant(id: string, site: CallSite, defaultValue: unknown, typeInfo: TypeInfo): TypeResolution {
  const resolution = resolveType(id, site, defaultValue, typeInfo);
  if (!resolution.ok || fitsType(defaultValue, resolution.type)) return resolution;
  return { ok: false, problem: `The default of '${id}' at ${describe(site)} doesn't match its type.` };
}

function resolveType(id: string, site: CallSite, defaultValue: unknown, typeInfo: TypeInfo): TypeResolution {
  if ('type' in typeInfo) return { ok: true, type: typeInfo.type };
  if ('unsupported' in typeInfo) {
    return { ok: false, problem: `'${id}' at ${describe(site)} has an unsupported type: ${typeInfo.unsupported}.` };
  }
  if ('unreadable' in typeInfo) {
    reportWarning(
      `Can't read the type argument of '${id}' at ${describe(site)} (${typeInfo.unreadable}). Its type is inferred from the default.`
    );
  }
  const inferred = inferType(defaultValue);
  return inferred.ok
    ? inferred
    : {
        ok: false,
        problem: `Can't infer the type of '${id}' at ${describe(site)} from its default: ${inferred.reason}.`,
      };
}

function constantAdapter(
  id: string,
  defaultValue: unknown,
  type: ConstantType,
  location: SourceLocation
): ValueAdapter {
  const options = literalOptions(type);
  const colorModel = type.kind === 'color' && typeof defaultValue === 'string' ? colorModelOf(defaultValue) : null;
  return {
    id,
    defaultValue,
    location,
    editable: true,
    isDefault: (value) => deepEqual(value, defaultValue),
    fits: (value) => fitsType(value, type),
    apply: (value) => writeSource(id, value),
    describe: (value, changed) => ({
      kind: 'constant',
      id,
      value,
      defaultValue,
      changed,
      location,
      options,
      colorModel,
    }),
    saveValue: (value) => constantSaveValue(id, location, value, defaultValue),
  };
}

function constantSaveValue(id: string, location: SourceLocation, value: unknown, defaultValue: unknown): SaveCandidate {
  if (!isPlainData(value)) return { ok: false, reason: SKIP_REASONS.value };
  if (!isPlainData(defaultValue)) return { ok: false, reason: SKIP_REASONS.default };
  return { ok: true, value: { kind: 'constant', id, location, value, loadedDefault: defaultValue } };
}

function isUnchanged(claim: Claim, defaultValue: unknown, typeInfo: TypeInfo): boolean {
  return deepEqual(claim.defaultValue, defaultValue) && deepEqual(claim.typeInfo, typeInfo);
}

function currentValue(claim: Claim, id: string, defaultValue: unknown): unknown {
  return claim.tuned ? readSource(id) : defaultValue;
}

function locationOf(site: CallSite): SourceLocation {
  return { file: site.token.file, line: site.line };
}

function describe(site: CallSite): string {
  return `${site.token.file}:${site.line}`;
}
