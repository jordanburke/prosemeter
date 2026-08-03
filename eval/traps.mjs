/**
 * Deterministic trap assertions — unit tests for facts.
 *
 * Every trap encodes a claim we watched a model get wrong, taken from `accuracy-*.json`. They are
 * plain text matching: no tokens, no model calls, no reviewer judgment to drift. Where a rubric'd
 * fact-check costs six agents reading ninety answers, this costs a second.
 *
 * Two shapes:
 *   - "qualifier"  the answer may make a claim that is only true with an exception attached.
 *                  `applies` detects the claim; `holds` looks for the exception.
 *   - "forbidden"  the claim is wrong outright. `applies` is the detection; `holds` is false.
 *
 * **Traps come from observed failures, never from guesses.** The first version of this file
 * invented three traps by reasoning about which qualifiers *ought* to be load-bearing. All three
 * passed 5/5 for every variant and measured nothing. Each trap below therefore carries `knownBad`:
 * the files it was derived from. `node eval/traps.mjs --validate` re-runs every trap against those
 * files and fails if one no longer fires. A trap that cannot catch the error it was built from is
 * broken, and this is the check that says so.
 *
 * Usage:
 *   node eval/traps.mjs [dir]     score a run           (default ./out)
 *   node eval/traps.mjs --validate    self-check against known-bad files
 */

import { readFileSync, readdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

const HERE = fileURLToPath(new URL(".", import.meta.url))

/** Does `re` match anywhere outside fenced code blocks? Prose claims only; snippets are checked by eye. */
const prose = (text) =>
  text
    .replace(/```[\s\S]*?```/g, " ")
    // Inline code fences break phrase matching — "`private` alone" would not match /private alone/.
    .replace(/`/g, "")

export const TRAPS = [
  {
    id: "retry-4xx-needs-429",
    task: "T3",
    scope: "sentence",
    claim: '"never retry a 4xx" — 429 and 408 are 4xx and are the canonical retry-after-backoff responses',
    knownBad: [
      "out/A-r1-T3", "out/C-r2-T3", "out/E-r1-T3", "out/E-r2-T3", "out/F-r1-T3", "out/F-r2-T3",
      "out-run2/E-r2-T3", "out-run2/Ep-r1-T3", "out-run2/Ep-r2-T3", "out-run2/Ep-r3-T3",
      "out-run2/Ep-r4-T3", "out-run2/Ep-r5-T3", "out-run2/G-r3-T3", "out-run2/G-r5-T3",
    ],
    applies: (s) =>
      /4xx/i.test(s) &&
      (/(never|not|don'?t|do not|avoid|stop)\s+retry/i.test(s) ||
        /not\s+retrying/i.test(s) ||
        /retry(ing)?\s+(only\s+on|that|it|them)/i.test(s) ||
        /4xx\s+(means|is|are)/i.test(s)),
    holds: (s) => /429/.test(s),
  },
  {
    id: "square-idempotency-is-a-body-field",
    task: "T3",
    scope: "document",
    claim: "Square takes idempotency_key as a request-body field, not an Idempotency-Key header like Stripe",
    knownBad: [
      "out/A-r2-T3", "out/B-r1-T3", "out/E-r1-T3",
      "out-run2/E-r3-T3", "out-run2/E-r5-T3", "out-run2/Ep-r5-T3", "out-run2/G-r4-T3",
    ],
    applies: (t) =>
      /\bSquare\b/.test(t) &&
      (/all\s+(accept|support|use|take)[^.]{0,50}header/i.test(t) ||
        /send\s+(it|the key|one)\s+as\s+an?\s+header/i.test(t) ||
        /key\s+by\s+header/i.test(t) ||
        /Idempotency-Key\s*:/i.test(t) ||
        /sending the header|confirm .{0,30}header/i.test(t) ||
        /Square[^.]{0,120}header/i.test(t) ||
        /header[^.]{0,120}Square/i.test(t)),
    // The body/field correction has to be attached to Square. An unrelated "scope the key to the
    // request body" elsewhere in the answer is not the same claim.
    holds: (t) =>
      /Square[^.]{0,140}(request body|body field|in the body|body parameter|idempotency_key)/i.test(t) ||
      /(request body|body field|body parameter)[^.]{0,140}Square/i.test(t),
  },
  {
    id: "resolver-never-violates-a-range",
    task: "T1",
    scope: "sentence",
    claim:
      "a package manager never resolves a dependency to a version outside a dependent's declared range; " +
      "non-overlapping ranges nest a second copy rather than handing one version to both",
    knownBad: [
      "out/A-r2-T1", "out/B-r1-T1", "out/E-r1-T1", "out/F-r1-T1", "out/F-r2-T1", "out/G-r2-T1",
      "out-run2/E-r2-T1", "out-run2/E-r3-T1", "out-run2/E-r4-T1",
      "out-run2/G-r3-T1", "out-run2/G-r5-T1",
      // G-r1-T1's error is the "fails outright" branch — see resolver-does-not-error-on-conflicting-ranges.
    ],
    applies: (s) =>
      // Hoisting one copy to the root is real and correct on its own. The error is the consequence:
      // that a dependent then runs against a version outside its declared range.
      /(one|a single)\s+(version|copy)[^.]{0,90}(both|shares? it|shared between|wrong for|whichever|the other|not written against|never tested)/i.test(
        s,
      ) ||
      /(gives?|hands?|shares?)\s+(it\s+)?(to\s+)?both/i.test(s) ||
      /(one version|whichever version|whichever one)\s+(wins|won)/i.test(s) ||
      /picks? one[^.]{0,60}(breaks?|hopes for the best)/i.test(s),
    // Correct when conditioned on the ranges overlapping — overlapping ranges really do dedupe to one
    // copy, and a dependent can then get a version it never tested. The error is asserting that
    // outcome unconditionally, for ranges that cannot both be satisfied.
    holds: (s) => /overlap|compatible range|same major|both accept|satisf(y|ies) both/i.test(s),
  },
  {
    id: "resolver-does-not-error-on-conflicting-ranges",
    task: "T1",
    scope: "sentence",
    claim:
      "npm, pnpm and yarn install a nested second copy for non-overlapping ranges and exit 0 — they do not " +
      "refuse to resolve. Install-time failure is a peer-dependency behaviour (npm ERESOLVE), not this case",
    knownBad: ["out-run2/E-r3-T1", "out-run2/G-r1-T1"],
    applies: (s) =>
      /(refuses? to pick|errors? out|fails? outright|install fails|refuses? to install|bails? out)/i.test(s),
    holds: (s) => /peer\s?dep|ERESOLVE|--legacy-peer-deps/i.test(s),
  },
  {
    id: "no-store-blocks-the-browser-too",
    task: "T6",
    scope: "sentence",
    claim:
      "`private, no-store` leaves no browser copy — no-store forbids every cache; `private` alone is what " +
      "permits a browser copy while barring shared caches",
    holdsScope: "window",
    knownBad: ["out-run2/E-r1-T6", "out-run2/Ep-r2-T6", "out-run2/G-r3-T6", "out-run2/G-r5-T6"],
    applies: (s) =>
      /private[^.]{0,60}(allows?|permits?|lets?|still)[^.]{0,60}(browser|client)/i.test(s) ||
      /(browser|client)[^.]{0,50}(keeps?|holds?|caches?)[^.]{0,40}cop(y|ies)/i.test(s),
    // "private *alone*" is the correct phrasing — the error is claiming a browser copy survives the
    // `private, no-store` pair actually being recommended.
    holds: (s) => /private\s+(alone|by itself|on its own)/i.test(s) || !/private,\s*no-store/i.test(s),
  },
  {
    id: "renders-do-not-re-run-a-stable-effect",
    task: "T4",
    scope: "sentence",
    claim:
      "a missing cleanup alone does not stack a listener per re-render — an effect re-runs only when a " +
      "listed dependency changes, so the claim needs the dependency qualifier",
    holdsScope: "window",
    knownBad: ["out/E-r1-T4", "out-run2/G-r4-T4", "out-run2/Ep-r5-T4"],
    applies: (s) =>
      /(every|each|per)\s+(re-?)?render/i.test(s) &&
      /(add|adds|adding|stack|stacks|stacking|attach|attaches|creat)/i.test(s) &&
      /(listener|subscription|handler|connection)/i.test(s),
    holds: (s) => /depend(ency|encies)?\b|deps\b|\[\s*\w+\s*\]/i.test(s),
  },
  {
    id: "usememo-does-not-hold-a-socket",
    task: "T4",
    scope: "sentence",
    claim: "useMemo is a performance hint with no cleanup hook; React may discard the value without closing the socket",
    knownBad: ["out/D-r1-T4"],
    applies: (s) =>
      /useMemo/.test(s) &&
      /(hoist|hold|keep|store|put)/i.test(s) &&
      // Wrapping object/function dependencies in useMemo is the correct, different use.
      !/\bdeps?\b|dependenc|useCallback/i.test(s),
    holds: () => false,
  },
  {
    id: "no-listenercount-on-a-socket",
    task: "T4",
    scope: "document",
    claim:
      "neither the browser WebSocket nor socket.io's emitter exposes listenerCount — it is a Node EventEmitter method",
    knownBad: ["out-run2/G-r3-T4"],
    applies: (t) => /\.listenerCount\s*\(/.test(t),
    holds: () => false,
  },
]

const sentences = (text) => prose(text).split(/(?<=[.!?])\s+|\n(?=[-*#])|\n\n/)

/**
 * A qualifier must sit with the claim it qualifies, so sentence-scoped traps look only at the
 * matching sentence. Checking the whole document instead lets an answer state a blanket rule in one
 * place, mention the exception somewhere unrelated, and pass — which is how the first version of
 * this trap cleared six answers that all gave the same wrong advice.
 */
const verdict = (trap, text) => {
  if (trap.scope === "document") {
    const t = prose(text)
    if (!trap.applies(t)) return "n/a"
    return trap.holds(t) ? "pass" : "FAIL"
  }
  const all = sentences(text)
  const idx = all.map((s, i) => [s, i]).filter(([s]) => trap.applies(s))
  if (idx.length === 0) return "n/a"
  // `holdsScope: "window"` widens the qualifier search to the neighbouring sentences, for cases where
  // the thing that invalidates a claim is the directive recommended just before it. The default stays
  // sentence-tight: an exception that lives elsewhere in the answer does not qualify the claim.
  const scopeOf = ([s, i]) =>
    trap.holdsScope === "window" ? all.slice(Math.max(0, i - 1), i + 2).join(" ") : s
  return idx.every((hit) => trap.holds(scopeOf(hit))) ? "pass" : "FAIL"
}

const readRun = (dir) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const [variant, rep, task] = file.replace(".md", "").split("-")
      return { file, variant, rep, task, text: readFileSync(`${dir}/${file}`, "utf8") }
    })

/* ── CLI ────────────────────────────────────────────────────────────────────────────────────── */

// Guarded so importing TRAPS (for a test, or an ad-hoc check) does not run the CLI as a side effect.
const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isEntry && process.argv.includes("--validate")) {
  let broken = 0
  console.log("Validating each trap against the files it was derived from.\n")
  for (const trap of TRAPS) {
    const misses = []
    for (const ref of trap.knownBad) {
      const path = `${HERE}${ref}.md`
      if (!existsSync(path)) {
        misses.push(`${ref} (missing — run artifacts are gitignored)`)
        continue
      }
      if (verdict(trap, readFileSync(path, "utf8")) !== "FAIL") misses.push(ref)
    }
    const caught = trap.knownBad.length - misses.length
    const ok = misses.length === 0
    if (!ok) broken++
    console.log(`${ok ? "ok  " : "BAD "} ${trap.id.padEnd(38)} catches ${caught}/${trap.knownBad.length}`)
    for (const m of misses) console.log(`       does not fire on ${m}`)
  }
  console.log(
    broken === 0
      ? "\nEvery trap fires on every error it was built from."
      : `\n${broken} trap(s) no longer catch their source error. Fix the pattern or drop the trap.`,
  )
  process.exit(broken === 0 ? 0 : 1)
}

if (isEntry) {
const dir = process.argv[2] ?? `${HERE}out`
const rows = readRun(dir).flatMap((a) =>
  TRAPS.filter((t) => t.task === a.task).map((t) => ({ ...a, trap: t.id, status: verdict(t, a.text) })),
)

const applicable = rows.filter((r) => r.status !== "n/a")
const variants = [...new Set(rows.map((r) => r.variant))].sort()

console.log(`${TRAPS.length} traps over ${readRun(dir).length} answers — ${applicable.length} applicable\n`)
console.log("variant   applicable  passed  failed")
for (const v of variants) {
  const rs = applicable.filter((r) => r.variant === v)
  const p = rs.filter((r) => r.status === "pass").length
  console.log(
    `${v.padEnd(9)} ${String(rs.length).padStart(10)} ${String(p).padStart(7)} ${String(rs.length - p).padStart(7)}`,
  )
}

const failures = applicable.filter((r) => r.status === "FAIL")
console.log(`\n${failures.length} failure(s):`)
for (const f of failures) {
  const trap = TRAPS.find((t) => t.id === f.trap)
  console.log(`  ${f.file.padEnd(16)} ${f.trap}`)
  console.log(`      ${trap.claim}`)
}
}
