export const DECLARATIONS_ENDPOINT = '/api/tuner/declarations';

export type SourceDeclaration = {
  id: string;
  name: string;
  context: string;
  file: string;
  line: number;
  value: string;
  important: boolean;
  selector: string;
  conditions: readonly string[];
  layer: string | null;
  theme: readonly string[] | null;
  unsupported: readonly string[];
  shadowed: boolean;
};

export type SourceProblem = { file: string; reason: string };

export type DeclarationsResponse =
  | { ok: true; declarations: readonly SourceDeclaration[]; problems: readonly SourceProblem[] }
  | { ok: false; reason: string };
