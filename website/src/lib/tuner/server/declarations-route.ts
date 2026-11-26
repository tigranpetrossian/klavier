import type { DeclarationsResponse, SourceDeclaration, SourceProblem } from '../shared/declarations-protocol.ts';
import { readCssDeclarations } from './css-declarations.ts';
import { readStylesheets, type ProjectFile } from './project-files.ts';
import { guardRequest } from './request-guard.ts';

type StylesheetReading = {
  declarations: readonly SourceDeclaration[];
  problems: readonly SourceProblem[];
};

export async function GET(request: Request): Promise<Response> {
  const guard = guardRequest(request);
  if (!guard.ok) {
    return respond({ ok: false, reason: guard.reason }, guard.status);
  }
  const stylesheets = await readStylesheets(guard.options);
  if (!stylesheets.ok) return respond(stylesheets, 500);
  const readings = stylesheets.stylesheets.map(readStylesheet);
  return respond(
    {
      ok: true,
      declarations: readings.flatMap((reading) => reading.declarations),
      problems: readings.flatMap((reading) => reading.problems),
    },
    200
  );
}

function readStylesheet({ file, text }: ProjectFile): StylesheetReading {
  const read = readCssDeclarations(text);
  if (!read.ok) {
    return { declarations: [], problems: [{ file, reason: read.reason }] };
  }
  return {
    declarations: read.declarations.map(({ declaration }) => ({
      ...declaration,
      file,
    })),
    problems: [],
  };
}

function respond(body: DeclarationsResponse, status: number): Response {
  return Response.json(body, { status });
}
