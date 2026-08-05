import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "tsdown"

const dir = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as { version: string }
const isProduction = process.env.NODE_ENV === "production"

export default defineConfig({
  // `baseline` is its own entry so its `node:fs` import lands in `dist/baseline.js` and never in
  // the chunk that carries `score()`. See the note in src/index.ts.
  entry: { index: "src/index.ts", baseline: "src/baseline.ts", "cli/index": "src/cli/index.ts" },
  format: ["esm"],
  dts: true,
  sourcemap: isProduction,
  clean: true,
  target: "node20",
  outDir: isProduction ? "dist" : "lib",
  platform: "node",
  treeshake: true,
  define: { __VERSION__: JSON.stringify(pkg.version) },
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
})
