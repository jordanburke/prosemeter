import { defineConfig } from "tsdown"
const isProduction = process.env.NODE_ENV === "production"
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  sourcemap: isProduction,
  clean: true,
  target: "node20",
  outDir: isProduction ? "dist" : "lib",
  platform: "node",
  treeshake: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
})
