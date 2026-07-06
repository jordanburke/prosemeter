# prosemeter — Design Specification

**Date:** 2026-07-05
**Status:** Approved design, ready for implementation planning
**Repo:** `jordanburke/prosemeter` · **npm scope:** `@prosemeter/*` + bare `prosemeter` · **Domain:** prosemeter.com

---

## 1. Context

AI agents close feedback loops on code easily: compilers, linters, and tests give deterministic, machine-readable signals. For **prose** — READMEs, docs, blog posts, reports — no equivalent fitness function exists. An agent that writes a document today gets no objective signal telling it whether revision N+1 is better than revision N, what specifically to fix, or when to stop revising.

prosemeter is that fitness function: a **deterministic scoring + feedback-loop layer for text documents**. It produces a 0–100 composite score against a named target profile, actionable findings with locations and fix hints, per-dimension baseline/delta comparison, and a convergence verdict — everything an agentic loop needs to revise, measure, and terminate.

**Prior art in-house:** `functype-eval` (in the functype monorepo) does exactly this for FP code fitness. prosemeter deliberately mirrors its proven patterns: declarative dimension registry, density normalization, weighted composite with renormalization, JSON + threshold + exit-code CI contract. Its known gap — no baseline/delta tracking — is a first-class feature here.

### Competitive landscape (verified 2026-07-05)

| Tool | What it has | What it lacks |
|---|---|---|
| **Vale** (Go) | YAML style rules, readability rules with grade targets, docs-team adoption | No composite score, no profiles, no baseline/delta/convergence, not embeddable in TS |
| **retext ecosystem** (JS) | Per-rule lint plugins incl. `retext-readability` (flags sentences 4-of-7 formulas call hard) | No scoring/aggregation layer — this is our substrate, not a competitor |
| **textlint / proselint / write-good / alex** | Style linting | Same as Vale, weaker |
| **`text-readability`, `readability-scores`, etc. (npm)** | Raw formula outputs | No findings, no aggregation, no structure awareness |
| **Readability MCP / writing-tools-mcp** | One-shot readability/stylometric analysis | No composite scoring, no loop contract, Python servers not libraries |
| **DeepEval / promptfoo / Braintrust** | LLM-as-judge metrics | Nothing deterministic for prose; promptfoo custom-JS assertions make it a *consumer* of prosemeter |

**Positioning:** nobody ships the combination of (1) deterministic composite scoring against profiles, (2) the agent loop contract, (3) TS library → CLI → MCP from one engine. The loop contract is the product; the formulas are commodities. Vale is complementary — a future `@prosemeter/vale` package can ingest its JSON output as an extra dimension source.

---

## 2. Doctrine (non-negotiables)

Carried over from functype-eval, plus loop-specific rules:

1. **Deterministic.** Same input → same output. No LLM calls, no network, no randomness in the scoring path. This is what makes it usable as a fitness function.
2. **Don't reimplement rules.** Style rules come from retext plugins. If a needed rule doesn't exist, prefer contributing a retext plugin (or a small in-house rule module clearly marked as such) over forking rule logic into scorers.
3. **Pure core.** `@prosemeter/core` knows nothing about NLP rules; scorer packages know nothing about aggregation, profiles, or output formats.
4. **The loop contract is the API.** Score alone is insufficient; every release must keep findings actionable (location + hint), deltas computable, and convergence decidable.
5. **Dogfood functype.** Core uses `Option` for absent values, `Either`/`Try` for fallible operations, `Validated` for accumulating config/parse errors. No `any`; strict TS everywhere.
6. **Dogfood prosemeter.** CI scores this repo's own README against the `readme` profile with a threshold gate.

---

## 3. Monorepo architecture

```
prosemeter/
  packages/
    core/           @prosemeter/core        engine: types, parsing, aggregation, profiles, loop
    readability/    @prosemeter/readability grade-band formula dimensions
    style/          @prosemeter/style       retext-based style lint dimensions
    structure/      @prosemeter/structure   mdast-based document-structure dimensions
    vocabulary/     @prosemeter/vocabulary  lexical diversity / consistency dimensions
    prosemeter/     prosemeter (bare)       batteries-included bundle + CLI (bin: prosemeter)
    mcp/            @prosemeter/mcp         MCP server (bin: prosemeter-mcp)
  docs/             specs + design docs (this file)
  turbo.json
  pnpm-workspace.yaml
  tsconfig.base.json
```

**Dependency flow (strict, acyclic):**

```
core ← readability, style, structure, vocabulary   (each implements core's provider interface)
core + all scorers ← prosemeter (bundle/CLI)
prosemeter ← mcp
```

- Workspace deps use `workspace:^`. Published peer ranges on `@prosemeter/core` use broad ranges (`>=0.1.0`), **not** narrow workspace ranges — see the functype 2026-05-30 cascade post-mortem: narrow published peer ranges force-major-bump dependents.
- All packages version **in lockstep** on one train (fixed group). v0.x until the loop contract stabilizes, then 1.0.
- New scorer domains = new packages implementing `DimensionProvider`. Planned future (NOT v1): `@prosemeter/vale` (ingest Vale JSON), `@prosemeter/spelling`, `@prosemeter/seo`.

### Tooling (matches Jordan's standard stack)

- **pnpm** workspaces (pnpm 11.x), **Turborepo** pipelines (`build`, `test`, `lint`, `lint:check`, `format`, `format:check`, `typecheck`, `validate`, `dev`) with `^build` topo deps — copy the shape of the functype monorepo's `turbo.json`.
- **ts-builds** in every package (tsdown under the hood), ESM-only output, `prettier: "ts-builds/prettier"`.
- **Vitest**, `test/` mirroring `src/` per package.
- Shared `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noImplicitReturns`.
- `.nvmrc` = `24` (npm OIDC trusted-publishing bug on Node 22 — keep 24+).
- **Releases:** changesets with a `fixed` group covering all packages (lockstep). GitHub Actions publish with OIDC trusted publishing + provenance. Register the npm org `@prosemeter` **before** first publish; grab bare `prosemeter` early.
- The repo currently contains the single-package ts-builds template — Phase 0 restructures it into the layout above.

---

## 4. Core engine (`@prosemeter/core`)

### 4.1 Parsing — parse once, share everywhere

Core owns the parse pipeline so every scorer sees the same trees and text extraction is consistent:

```
raw string
  → remark-parse (+ remark-frontmatter, remark-gfm)  → mdast
  → remark-retext bridge (retext-english)            → nlcst
  → plaintext extraction + document stats
```

```ts
type DocumentFormat = "markdown" | "plaintext"

type ParsedDocument = {
  readonly raw: string
  readonly format: DocumentFormat
  readonly mdast: Root            // mdast Root (markdown only; synthetic single-paragraph tree for plaintext)
  readonly nlcst: NlcstRoot       // retext-english tree of prose content
  readonly plaintext: string      // prose only: front matter stripped, code blocks/URLs excluded
  readonly stats: DocumentStats
}

type DocumentStats = {
  readonly words: number
  readonly sentences: number
  readonly paragraphs: number
  readonly characters: number     // letters/digits only (for Coleman-Liau, ARI)
  readonly syllables: number
  readonly complexWords: number   // 3+ syllables, excluding proper nouns/compounds (Fog convention)
  readonly headings: ReadonlyArray<{ depth: number; text: string; line: number }>
  readonly codeBlocks: number
  readonly links: number
  readonly listItems: number
}
```

**Prose extraction rules:** YAML/TOML front matter stripped; fenced/indented code blocks and inline code excluded from prose analysis (still counted in `stats` for structure metrics); URLs excluded from word/syllable counts; heading text included as prose.

Parsing returns `Either<ParseError, ParsedDocument>`. Empty/whitespace-only input is a distinct error (drives exit code 2 — never a vacuous 100/100; same guard as functype-eval).

### 4.2 Dimension model

```ts
type DimensionId = string          // e.g. "passive-voice", "grade-band", "heading-hierarchy"

type Severity = "info" | "warn" | "error"

type Finding = {
  readonly rule: string            // e.g. "retext-passive", "sentence-length"
  readonly dimension: DimensionId
  readonly severity: Severity
  readonly message: string         // what is wrong
  readonly hint: string            // what to DO about it — required, agent-facing
  readonly loc: Option<{ line: number; column: number; offset: number; length: number }>
  readonly excerpt: string         // the offending text, ≤120 chars
}

type DimensionResult = {
  readonly id: DimensionId
  readonly score: number           // 0.0–1.0
  readonly weight: number          // effective weight after profile + renormalization
  readonly detail: string          // human-readable, e.g. "median grade 14.2 vs band 8–12"
  readonly findings: ReadonlyArray<Finding>
  readonly skipped: Option<string> // reason, e.g. "document too short for MTLD"
}

// What scorer packages implement:
type DimensionProvider = {
  readonly id: DimensionId
  readonly defaultWeight: number
  readonly evaluate: (doc: ParsedDocument, config: DimensionSettings) => Try<DimensionResult>
}
```

Providers are registered with the engine (the bundle package registers all built-ins). A provider throwing/failing marks the dimension `skipped` with the error message — one broken rule never kills a scoring run.

### 4.3 Scoring math

Three normalization strategies, chosen per dimension:

1. **Density** (count-based dims — style, some structure/vocab):
   `score = 1 / (1 + (violations / KW) × k)` where `KW = words / 1000` and `k` is per-dimension sensitivity (calibrated so a "typical mediocre doc" lands ~0.5). Rationale (from functype-eval): lint rules report counts, not opportunity denominators; density is length-fair.

2. **Band** (target-range dims — readability grade, sentence-length variance, structure ratios):
   inside `[lo, hi]` → `1.0`; outside → `1 / (1 + d² × kb)` where `d = distance to nearest band edge` and `kb` defaults to `0.5`. **Bidirectional by design** — a doc can be too complex *or* too simplistic.

3. **Ratio** (native-proportion dims — e.g. acronyms-defined / acronyms-used): use the ratio directly.

**Composite:**
`score = round( 100 × Σ(wᵢ × sᵢ) / Σ(wᵢ) )` over **active** (non-skipped) dimensions — skipped weight redistributes automatically, so the composite stays a proper weighted average (functype-eval's renormalization).

### 4.4 Profiles

A profile is pure data: grade band, weight overrides, per-rule severity/enable, band parameters.

```ts
type Profile = {
  readonly name: string
  readonly description: string
  readonly gradeBand: { lo: number; hi: number }
  readonly weights: Partial<Record<DimensionId, number>>   // overrides defaultWeight; 0 disables
  readonly rules: Partial<Record<string, Severity | "off">>
  readonly thresholdDefault: number                         // suggested --threshold
}
```

Built-in profiles (v1):

| Profile | Grade band | Character |
|---|---|---|
| `plain` (default) | 8–12 | Neutral defaults, all dims at default weight |
| `readme` | 8–12 | Structure weighted up (headings, section length, code-ratio expected), clichés harsh |
| `api-docs` | 8–13 | Consistency/terminology weighted up, passive voice tolerated slightly, code-ratio expected high |
| `blog` | 7–10 | Sentence-variety and clarity weighted up, structure relaxed |
| `marketing` | 6–9 | Brevity and simplicity harsh, hedging harsh, lexical-diversity relaxed |
| `academic` | 12–16 | Passive voice tolerated, hedging tolerated, grade band high |

User overrides via `prosemeter.config.json` (cwd or `--config`): `{ "extends": "readme", "gradeBand": {...}, "weights": {...}, "rules": {...} }`. Config validation accumulates all errors via `Validated` and reports them together.

### 4.5 Score result (the JSON contract)

```ts
type ScoreResult = {
  readonly target: string              // path or "<stdin>"
  readonly profile: string
  readonly score: number               // 0–100
  readonly stats: DocumentStats
  readonly dimensions: ReadonlyArray<DimensionResult>
  readonly version: string             // prosemeter version that produced this (baseline compat check)
}
```

This shape deliberately parallels functype-eval's `ScoreResult` so a shared `eval-core` extraction remains a mechanical refactor if ever wanted.

### 4.6 Loop contract

**Baseline/delta:**

```ts
type DeltaReport = {
  readonly scoreDelta: number
  readonly verdict: "improved" | "regressed" | "unchanged"     // |Δ| < 1 → unchanged
  readonly dimensions: ReadonlyArray<{
    readonly id: DimensionId
    readonly delta: number
    readonly verdict: "improved" | "regressed" | "unchanged"
  }>
  readonly findingsResolved: ReadonlyArray<Finding>            // in baseline, not in current
  readonly findingsNew: ReadonlyArray<Finding>                 // in current, not in baseline
}
```

Finding identity for diffing: `(rule, dimension, hash(normalized excerpt))` — location-independent, so unrelated edits shifting line numbers don't produce false new/resolved churn.

**Convergence guard:**

```ts
type ConvergenceVerdict = "improving" | "plateaued" | "oscillating" | "converged"

// checkConvergence(history: number[], options?: { threshold?: number; window?: number; epsilon?: number })
```

Rules (defaults: `window = 3`, `epsilon = 1.0`):
- `converged` — latest score ≥ threshold (when a threshold is supplied)
- `plateaued` — all deltas within the window are `< epsilon` in magnitude
- `oscillating` — deltas within the window alternate sign with magnitude ≥ epsilon
- `improving` — otherwise, latest delta positive

Pure function over a score history the caller supplies; CLI convenience persists history in the baseline file (`history: number[]` appended on `--save-baseline`). **This is the agent's stop condition** — revise while `improving`, stop on anything else.

---

## 5. Scorer packages — v1 dimensions

Default weights sum to 1.0 across the four packages. `k` = density sensitivity; calibrate against the golden corpus during implementation (values below are starting points).

### `@prosemeter/readability` (total 0.30)

| Dimension | Weight | Strategy | Detail |
|---|---|---|---|
| `grade-band` | 0.20 | band | Median of Flesch-Kincaid, Gunning Fog, SMOG, Coleman-Liau, ARI vs profile band. Findings: none doc-level; detail reports each formula. Also reports Flesch Reading Ease as info. |
| `sentence-complexity` | 0.10 | density, k=0.6 | Per-sentence flagging via `retext-readability` (threshold 4/7 formulas). Each hard sentence → finding with excerpt + hint ("38 words, grade ~16 — split or simplify"). |

Formula deps: prefer the wooorm micro-packages (`flesch`, `flesch-kincaid`, `gunning-fog`, `smog-formula`, `coleman-liau`, `automated-readability`, `syllable`) feeding counts from core's `DocumentStats`. Verify current package names/health on npm at implementation time.

Skip guard: documents < 30 words → `grade-band` skipped ("too short for reliable formulas").

### `@prosemeter/style` (total 0.30)

| Dimension | Weight | Strategy | Rules (retext plugins) |
|---|---|---|---|
| `passive-voice` | 0.08 | density, k=0.5 | `retext-passive` |
| `clarity` | 0.08 | density, k=0.5 | `retext-simplify` (wordy phrases → simpler alternative in hint) |
| `hedging` | 0.05 | density, k=0.4 | `retext-intensify` (weasels, hedges, intensifiers) |
| `redundancy` | 0.04 | density, k=0.4 | `retext-repeated-words`, `retext-redundant-acronyms`; cliché list (use a maintained retext cliché plugin if one exists — verify — else port write-good's cliché word list as an in-house rule module) |
| `sentence-variety` | 0.05 | band | Coefficient of variation of sentence lengths; band ~[0.4, 0.9]. Monotone same-length runs → finding. |

Every retext message maps to a `Finding` with the plugin's `expected` suggestion folded into `hint`.

### `@prosemeter/structure` (total 0.25) — markdown-aware (dims auto-skip for plaintext where meaningless)

| Dimension | Weight | Strategy | Detail |
|---|---|---|---|
| `heading-hierarchy` | 0.06 | density, k=1.0 | Skipped levels (h2→h4), multiple h1s, empty sections, headings-as-bold-text heuristic |
| `section-length` | 0.07 | band | Words per section vs band (profile-dependent, e.g. readme [40, 400]). Wall-of-text finding: section > hi with 0 lists/code breaks |
| `paragraph-length` | 0.06 | band | Sentences per paragraph, band ~[1, 6]; >8 → finding with split hint |
| `document-balance` | 0.06 | band | Composite ratios: list-items/paragraphs, links/1000 words, code-blocks/section (profile-dependent expectations) |

### `@prosemeter/vocabulary` (total 0.15)

| Dimension | Weight | Strategy | Detail |
|---|---|---|---|
| `lexical-diversity` | 0.05 | band | MTLD (implement in-house — small, well-specified algorithm; no maintained npm package). Band ~[50, 120]. Skip < 100 words. |
| `terminology-consistency` | 0.05 | density, k=0.8 | Same-concept variant detection: case variants ("GitHub"/"Github"), hyphenation variants ("front-end"/"frontend"), configurable term map in profile/config |
| `acronym-definition` | 0.03 | ratio | Acronyms (≥2 caps, not in allowlist) used before/without definition ("Term (ACRO)" pattern). Allowlist seeded (API, URL, HTTP…) and profile-extendable |
| `spelling-consistency` | 0.02 | density, k=0.5 | US/UK mixing detection (word-list based, e.g. "color" + "colour" in one doc → finding on minority variant) |

---

## 6. Bundle + CLI (`prosemeter`, bare package)

Library API:

```ts
import { score, compareBaseline, checkConvergence, profiles } from "prosemeter"

const result = await score(text, { profile: "readme" })          // ScoreResult
const delta  = compareBaseline(result, previousResult)            // DeltaReport
const verdict = checkConvergence([62, 71, 74, 74.5], { threshold: 80 })
```

CLI:

```
prosemeter score <file|glob|-> [options]
  --profile <name>          plain | readme | api-docs | blog | marketing | academic  (default: plain)
  --config <path>           prosemeter.config.json (default: ./prosemeter.config.json if present)
  --json                    machine-readable ScoreResult (+ delta/convergence when applicable)
  --threshold <n>           exit 1 if score < n
  --baseline <path>         emit DeltaReport vs stored baseline
  --save-baseline [path]    write ScoreResult (+ appended score history) after scoring (default .prosemeter/baseline.json)
  --format <md|text>        force input format (default: infer from extension)
prosemeter profiles         list built-in profiles + their bands/weights
```

- **Exit codes:** `0` pass · `1` below threshold · `2` no/empty input or nothing matched (functype-eval contract).
- Human output: score header, per-dimension table, then findings grouped by dimension sorted by severity, each with `file:line:col`, message, hint.
- Multiple files: score each, report each + unweighted mean; threshold applies to the mean (v1; per-file gating later if needed).
- `-` reads stdin (essential for agents piping draft text).

## 7. MCP server (`@prosemeter/mcp`)

Tools (thin wrappers over the bundle API — no logic of its own):

| Tool | Input | Output |
|---|---|---|
| `score_text` | `{ text, profile?, format? }` | `ScoreResult` |
| `score_file` | `{ path, profile?, configPath? }` | `ScoreResult` |
| `compare_baseline` | `{ current: ScoreResult, baseline: ScoreResult }` | `DeltaReport` |
| `check_convergence` | `{ history: number[], threshold?, window?, epsilon? }` | `{ verdict, detail }` |
| `list_profiles` | `{}` | profile summaries (name, description, band, threshold default) |

- Framework: **fastmcp** (Jordan's stack; `functype-mcp-server` is the reference implementation to mirror), stdio transport for v1.
- Tool descriptions must teach the loop explicitly: *"Typical agent loop: score_text → revise using findings/hints → score_text again → compare_baseline → repeat while check_convergence returns 'improving'."*
- Server instructions block documents the loop pattern the same way.

---

## 8. Testing strategy

1. **Golden corpus** — `fixtures/` of small documents with hand-verified characteristics: `dense-academic.md`, `choppy-simplistic.md`, `wall-of-text.md`, `good-readme.md`, `passive-heavy.md`, `mixed-spelling.md`, plaintext samples. Snapshot full `ScoreResult` JSON per fixture × profile (determinism makes snapshots stable).
2. **Determinism test** — score every fixture twice, assert deep equality.
3. **Unit tests per dimension** — targeted minimal inputs per rule (e.g. one passive sentence → exactly one finding with correct loc/hint).
4. **Scoring-math property tests** — band function symmetric around band, monotone decreasing with distance; density monotone in violations; renormalization: skipping a dimension never changes the sign of others' contributions; composite bounds [0, 100].
5. **Loop-contract tests** — baseline diff resolves/creates findings correctly under line-shift edits (identity hashing); convergence verdicts for crafted histories (improving/plateau/oscillation/converged).
6. **CLI e2e** — run built CLI against tmp dirs: exit codes 0/1/2, `--json` schema, baseline round-trip.
7. **Dogfood gate in CI** — `prosemeter score README.md --profile readme --threshold 70`.

Calibration note: `k` values and bands get tuned once against the corpus so fixtures land in intuitive score ranges (good-readme ≥ 85, wall-of-text ≤ 50); after calibration they're frozen constants.

---

## 9. Implementation phases (suggested order)

- **Phase 0 — monorepo restructure.** Template → `packages/*` layout, turbo.json, tsconfig.base.json, changesets (fixed group), CI (`turbo run validate`). Register npm org `@prosemeter` + reserve bare `prosemeter` (manual step: Jordan).
- **Phase 1 — core + readability.** Parse pipeline, dimension model, scoring math, profiles, `ScoreResult`; readability package; first fixtures.
- **Phase 2 — CLI (minimal).** `score` + `--json` + `--threshold` + exit codes in the bundle package. *End of Phase 2 = usable feedback tool.*
- **Phase 3 — loop features.** Baseline/delta, `--save-baseline` + history, convergence. *End of Phase 3 = the differentiator shipped.*
- **Phase 4 — remaining scorers.** style, structure, vocabulary; full profile weight tables; calibration pass.
- **Phase 5 — MCP server.** Five tools + loop-teaching descriptions.
- **Phase 6 — polish.** README (scored by itself in CI), dogfood gate, publish pipeline dry-run, v0.1.0 release.

Each phase lands green (`turbo run validate`) before the next starts.

### Implementation notes for the executing agent

- Verify npm package names/health before adding deps (`retext-*` plugin set, wooorm formula packages, `syllable`); the retext cliché plugin specifically needs verification — if unmaintained/absent, port write-good's cliché list in-house per doctrine rule 2.
- Look up unfamiliar libs in context7 before use (unified/remark/retext APIs have shifted across majors; all are ESM-only — fine, this repo is ESM-only).
- Reference implementations to read first: `/Users/jordanburke/IdeaProjects/functype/packages/functype-eval` (scoring engine patterns), `/Users/jordanburke/IdeaProjects/functype/turbo.json` + root `package.json` (monorepo shape), `/Users/jordanburke/IdeaProjects/functype/packages/mcp-server` (fastmcp usage).
- functype (`Option`, `Either`, `Try`, `Validated`) is a regular published dependency of `@prosemeter/core` — not a workspace link.

## 10. Non-goals (v1)

- **No LLM-judge dimensions** — deterministic only; an LLM layer can consume prosemeter, never live inside it.
- **No grammar/spell checking** — LanguageTool/cspell territory; possible future `@prosemeter/spelling` wrapper package.
- **No Vale ingestion** — designed-for (`DimensionProvider` makes it a plugin) but not built.
- **No editor integrations / LSP, no docs site, no HTML reports.**
- **No non-English support** — formulas and word lists are English-calibrated; `language` config key reserved.
- **No per-file threshold gating on globs** — mean-based gating only in v1.
