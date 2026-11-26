import { check, format, resolveConfig, type Options } from 'prettier';

export async function formatLikeOriginal(file: string, original: string, edited: string): Promise<string | null> {
  const options = await prettierOptionsFor(file);
  if (options === null || !(await isFormatted(original, options))) {
    return edited;
  }
  try {
    return await format(edited, options);
  } catch {
    return null;
  }
}

async function prettierOptionsFor(file: string): Promise<Options | null> {
  try {
    return {
      ...(await resolveConfig(file, { useCache: false })),
      filepath: file,
    };
  } catch {
    return null;
  }
}

async function isFormatted(text: string, options: Options): Promise<boolean> {
  try {
    return await check(text, options);
  } catch {
    return false;
  }
}
