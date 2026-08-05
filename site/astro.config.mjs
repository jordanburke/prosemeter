import { defineConfig } from "astro/config"

/**
 * `pluralize` (via retext-redundant-acronyms, via the concision dimension) is UMD, and picks where
 * to put its export with:
 *
 *     typeof require === "function" && typeof exports === "object" && typeof module === "object"
 *
 * Bundled as ESM there is no `require`, so it skips the Node branch and falls through to the
 * browser-global branch — which the CommonJS wrapper feeds the `exports` object. `module.exports`
 * is never assigned, the default import comes back without any methods, and the scorer dies on its
 * first run with `pluralize.addSingularRule is not a function`.
 *
 * Rewriting the guard for that one file is the smallest fix that keeps the package's own Node
 * branch, which is the one it was written for. `@rollup/plugin-commonjs`'s `strictRequires` does
 * not reach it — Astro does not thread `vite.build.commonjsOptions` into the worker bundle.
 */
const fixPluralizeUmd = () => ({
  name: "fix-pluralize-umd",
  enforce: /** @type {const} */ ("pre"),
  transform(code, id) {
    if (!id.includes("/pluralize/pluralize.js")) return null
    const patched = code.replace("typeof require === 'function'", "true")
    if (patched === code) throw new Error("fix-pluralize-umd: guard not found — did pluralize change?")
    return { code: patched, map: null }
  },
})

export default defineConfig({
  site: "https://prosemeter.com",
  // Static output, no adapter. Cloudflare Pages serves a directory; there is nothing to run.
  output: "static",
  vite: {
    plugins: [fixPluralizeUmd()],
    // Worker bundles get their own plugin pipeline; `vite.plugins` does not reach them.
    worker: { format: "es", plugins: () => [fixPluralizeUmd()] },
    resolve: {
      /**
       * Prefer the `worker` export condition over `browser`.
       *
       * `decode-named-character-reference`, deep under micromark, ships two builds. Its `browser`
       * one decodes HTML entities with `document.createElement("i")` and `innerHTML`; its `worker`
       * one is a plain lookup table over `character-entities`. Vite's default client conditions put
       * `browser` first, so the scoring worker got the DOM build and died on its first markdown
       * parse with `ReferenceError: document is not defined`.
       *
       * Set globally rather than for the worker alone: the lookup-table build is correct in a
       * document too, just marginally larger, and one resolution order is easier to reason about
       * than two.
       */
      conditions: ["worker", "module", "browser", "development|production"],
    },
    // Vite skips dependency pre-bundling for linked workspace packages. Without this, `astro dev`
    // serves the whole unbundled remark/micromark/retext graph as hundreds of module requests on
    // every reload, which makes the dev loop unusable.
    optimizeDeps: { include: ["prosemeter"] },
  },
})
