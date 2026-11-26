import type { TransformOptions, TransformResult } from './transform-module.ts';
import path from 'node:path';

type LoaderCallback = (error: Error | null, code?: string, map?: unknown) => void;

type LoaderOptions = Omit<TransformOptions, 'file'>;

export type TunerLoaderContext = {
  readonly resourcePath: string;
  getOptions(): unknown;
  addDependency(file: string): void;
  async(): LoaderCallback;
};

export default function tunerLoader(this: TunerLoaderContext, source: string, inputMap?: unknown): void {
  const callback = this.async();
  const options = parseLoaderOptions(this.getOptions());
  if (options === null) {
    callback(
      new Error(`[tuner] The loader options for ${this.resourcePath} are not { root, sourceDirectory, exclude }.`)
    );
    return;
  }
  transform(source, { ...options, file: this.resourcePath }).then(
    (result) => {
      if (result === null) {
        callback(null, source, inputMap);
        return;
      }
      for (const dependency of result.dependencies) this.addDependency(dependency);
      callback(null, result.code, result.map);
    },
    (error: unknown) => callback(error instanceof Error ? error : new Error(String(error)))
  );
}

async function transform(source: string, options: TransformOptions): Promise<TransformResult | null> {
  const { transformModule } = await import('./transform-module.ts');
  return transformModule(source, options);
}

function parseLoaderOptions(options: unknown): LoaderOptions | null {
  if (!isRecord(options)) return null;
  const { root, sourceDirectory, exclude } = options;
  if (typeof root !== 'string' || !path.isAbsolute(root) || typeof sourceDirectory !== 'string') return null;
  if (!Array.isArray(exclude) || !exclude.every((entry) => typeof entry === 'string')) return null;
  return { root, sourceDirectory, exclude };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
