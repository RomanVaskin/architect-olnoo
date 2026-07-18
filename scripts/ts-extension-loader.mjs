import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Minimal ESM resolve hook so plain `node --test` can run this project's
 * TypeScript sources directly (Node's native type-stripping handles the
 * syntax; this hook only adds the extension resolution that "bundler"-style
 * TS imports rely on and plain Node ESM does not do on its own).
 * Not a test framework or new dependency — used only via `npm run test`.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    for (const ext of [".ts", ".tsx", ".js"]) {
      const candidate = new URL(specifier + ext, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(specifier + ext, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
