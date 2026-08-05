# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

prosemeter scores prose deterministically. Given a document and a named profile it returns a 0–100
composite, a per-dimension breakdown, and findings with locations and fix hints — enough for an
agent to revise, re-measure, and know when to stop.

It is a pnpm + Turborepo monorepo of seven packages, all released together on one version train.

| package | role |
| --- | --- |
| `@prosemeter/core` | engine — parsing, dimension model, scoring math, profiles |
| `@prosemeter/readability` | grade-band, sentence-simplicity |
| `@prosemeter/structure` | heading hierarchy, section/paragraph length, document balance |
| `@prosemeter/style` | active voice, clarity, directness, concision |
| `@prosemeter/vocabulary` | lexical diversity, terminology and spelling consistency |
| `prosemeter` | batteries-included entry point + the `prosemeter` CLI |
| `@prosemeter/mcp` | MCP server over the same engine |

Only `prosemeter` depends on the dimension packages; only `@prosemeter/mcp` depends on
`prosemeter`. The dimension packages depend on `@prosemeter/core` and on nothing else here.

## Development Commands

Run from the repo root. Everything goes through Turborepo, which fans out to `ts-builds` per package.

```bash
pnpm validate        # format + lint + typecheck + test + build across all packages — run before every commit
pnpm build           # build all packages (dist/)
pnpm test            # run all tests
pnpm typecheck
pnpm format          # Prettier
pnpm lint            # ESLint, fixing
pnpm clean           # remove dist + .turbo
```

Scoped to one package:

```bash
pnpm --filter @prosemeter/style test
pnpm --filter @prosemeter/style test -- test/style.spec.ts
pnpm --filter prosemeter build
```

## Architecture

### Scoring model

A dimension returns a raw measurement, which a **normalization strategy** maps to 0–1:

- `density` — `1 / (1 + (violations / KW) * k)`, for "fewer is better" counts
- `band` — 1 inside `[lo, hi]`, falling off as `1 / (1 + d² × kb)` outside. **Bidirectional**: a
  document can be too complex *or* too simplistic. `grade-band` uses this, so telegraphic prose is
  penalised as well as dense prose.
- `ratio` — the proportion is the score

The composite is a weighted average over active dimensions, with weights renormalized by the active
weight sum so skipping a dimension never distorts the others (`packages/core/src/scoring.ts`).

**Read the per-dimension scores, not the composite.** The composite averages real effects away —
`eval/` measured a 79.5–86.6 composite spread against a 15-point within-variant spread while the
dimensions moved 2–3x over the same data.

### Profiles

`packages/core/src/profiles.ts` holds the seven built-ins: `plain`, `readme`, `api-docs`, `blog`,
`marketing`, `academic`, `chat`. A profile sets a grade band, per-dimension weights, rule severities,
a suggested threshold, and `dimensionOptions` passed through to the dimension.

`chat` scores conversational agent replies. It zeroes `heading-hierarchy`, `section-length`,
`document-balance`, and `acronym-definition`, because a chat reply has no document structure.

### Style dimensions and ignore lists

The `retext-*` plugins under `@prosemeter/style` flag ordinary technical vocabulary out of the box.
Three dimensions therefore ship curated ignore lists — `CLARITY_IGNORE_DEFAULT`,
`HEDGE_IGNORE_DEFAULT` — resolved through `packages/style/src/ignore-options.ts`. A caller can extend
them with `ignore`, or replace them with `useDefaultIgnore: false`.

These are not cosmetic. Before `CLARITY_IGNORE_DEFAULT`, `clarity` was a topic detector: it flagged
`effect`, `request`, `render`, `function`, and `component` as wordy, giving a corpus mean of 54.1 and
a 165:1 ratio on writing-about-writing. Adding one is a real behavior change — measure it.

### Build system

`ts-builds` provides the scripts; `tsdown` bundles. Each package has a `tsdown.config.ts` importing
the shared config, and a `tsconfig.json` extending `ts-builds/tsconfig`. Output is ESM plus `.d.ts`
in `dist/`.

### Testing

Vitest. Tests live in `packages/<pkg>/test/*.spec.ts`, not beside the source.

Several suites read the shared `fixtures/` corpus at the repo root, and
`packages/readability/test/__snapshots__/` pins whole-document scoring. Changing a dimension's
defaults will move those numbers — the diff is the point, so read it rather than updating the
snapshot reflexively.

## The eval harness

`eval/` is not part of the published library — not a workspace package, not built, not imported.

It A/B-tests **writing instructions** against prosemeter: instruction is the independent variable,
score is the dependent variable. Read `eval/README.md` before running anything there; it records the
method and a list of results that do not need re-deriving.

The two findings most likely to be re-derived by accident:

- Instruction wording moves length and vocabulary 2–3x and does **not** move factual accuracy at all.
  Do not try to fix accuracy with a prompt.
- Metric stability depends on the task set. `words` scored a variance ratio of 0.7 on six
  same-register tasks and 1.3 on ten mixed ones — it was an artifact. `sentence-simplicity` held at
  1.5 across both and is the one to lean on.

`eval/compare.mjs` gates a run against `eval/baseline.json` and exits 2 if the task set differs.

## Key Files

- `packages/core/src/scoring.ts` — normalization strategies and the composite
- `packages/core/src/profiles.ts` — the built-in profiles
- `packages/prosemeter/src/index.ts` — public entry point. **Keep it free of Node built-ins.** A
  value re-export from `./baseline` would drag `node:fs` into the module graph and make `score()`
  unbundleable for a browser, which the site depends on. Baseline persistence is a separate tsdown
  entry and a separate `prosemeter/baseline` subpath export for exactly that reason.
- `packages/prosemeter/src/cli/` — the `prosemeter` CLI
- `packages/mcp/src/server.ts` — the five MCP tools
- `.claude/skills/prose-loop/SKILL.md` — the score/revise/stop loop, shipped as a skill
- `.claude-plugin/` — plugin and marketplace manifests
- `docs/LIB_SPEC_prosemeter_2026-07-05.md` — the original spec
- `RELEASING.md` — the release train

## Publishing

Changesets, one `fixed` group, so a single version applies to all seven packages. npm OIDC trusted
publishing with provenance; no `NPM_TOKEN`.

```bash
pnpm changeset       # describe the change; one entry bumps every package
```

Merge to `main`, then merge the "Version Packages" pull request the workflow opens. See
`RELEASING.md` — in particular, the publish workflow filename must stay `publish.yml` and `.nvmrc`
must stay at Node 24 or newer.

## The site

`site/` is the source for prosemeter.com — Astro, static, deployed to Cloudflare Pages by
`.github/workflows/deploy-site.yml`. It is a workspace member (`pnpm-workspace.yaml`) but lives
outside `packages/`, because everything in there is published to npm and this is not.

It scores **in the browser**, which is why `packages/prosemeter/src/index.ts` must stay free of Node
built-ins. `site/scripts/assert-browser-safe.mjs` walks the built module graph and fails the build if
that regresses.

Three things about the bundle, each of which cost an afternoon:

- The scorer runs in a **Web Worker**. Not only for jank — `score()` returns a functype `Either` and
  `Option`s, none of which survive structured clone, so the boundary forces `toScoreResultJSON`.
  Never import a *value* from `scorer.worker.ts` into the page script; it pulls the whole engine into
  the page chunk. Shared constants live in `src/lib/limits.ts` for exactly this reason.
- `astro.config.mjs` puts the `worker` export condition ahead of `browser`, because
  `decode-named-character-reference` ships a DOM-based entity decoder under `browser` that dies in a
  worker.
- A small Vite plugin rewrites `pluralize`'s UMD guard. It is registered **twice** — under
  `vite.plugins` and `vite.worker.plugins` — because worker bundles get their own plugin pipeline.

The first result is rendered at build time in `Scorer.astro`'s frontmatter, so the demo works with
JavaScript disabled and the heavy chunk never blocks first paint. **No score is ever typed by hand**;
copy that quotes a number computes it from `fixtures/`.

The site does not use `ts-builds` and has no `lint` or `test` task — `astro check` covers it. That is
a deliberate break from the uniformity every package under `packages/` follows.
