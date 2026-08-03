/**
 * Deterministic trap assertions.
 *
 * Each trap encodes a qualifier that is load-bearing for a claim's truth: the rule is false
 * without it in a case a reader would plausibly hit. They cost no tokens, never drift, and are
 * immune to the reviewer-threshold problem that made the cross-model pass uninterpretable.
 *
 * They are a ratchet, not a metric. A trap tests one known error, not the general property, and
 * an instruction tuned to satisfy a published trap can satisfy it without fixing the underlying
 * behaviour. Use them to catch regressions on errors already seen; use the reviewer passes to
 * find new ones.
 *
 * Only tasks with a cleanly assertable qualifier have traps. T1, T2 and T4 do not — their error
 * classes need a reader.
 *
 * Usage: node eval/traps.mjs [dir]   (default ./out)
 */

import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"

const DIR = process.argv[2] ?? fileURLToPath(new URL("./out", import.meta.url))

const TRAPS = {
  // "Never retry a 4xx" is false: 429 (and 408) are retryable. The trap fires only when the
  // answer actually makes the don't-retry-4xx claim, so an answer that never raises it passes.
  T3: {
    qualifier: "names 429 as an exception when claiming 4xx is not retryable",
    applies: (t) => /4xx/i.test(t) && /(never|don'?t|do not|avoid|no point)[^.]{0,60}retry/i.test(t),
    holds: (t) => /429/.test(t),
  },
  // "useCallback stops re-renders" is false unless the child is wrapped in React.memo — without
  // it the child re-renders regardless and the hook buys nothing.
  T5: {
    qualifier: "conditions useCallback's benefit on the child being memoized",
    applies: () => true,
    holds: (t) => /React\.memo|\bmemo\s*\(|memoi[sz]ed child|wrapped in memo/i.test(t),
  },
  // "Cache every GET" is false for authenticated or per-user responses in a shared cache —
  // following it unqualified leaks one user's data to another.
  T6: {
    qualifier: "excludes per-user or authenticated responses from a shared cache",
    applies: () => true,
    holds: (t) => /per[- ]user|private|authenticated|logged[- ]in|Vary|user[- ]specific/i.test(t),
  },
}

const rows = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .map((file) => {
    const [variant, rep, task] = file.replace(".md", "").split("-")
    const trap = TRAPS[task]
    if (!trap) return null
    const text = readFileSync(`${DIR}/${file}`, "utf8")
    if (!trap.applies(text)) return { file, variant, task, status: "n/a" }
    return { file, variant, task, status: trap.holds(text) ? "pass" : "FAIL" }
  })
  .filter(Boolean)

const variants = [...new Set(rows.map((r) => r.variant))].sort()
const tasks = Object.keys(TRAPS).filter((t) => rows.some((r) => r.task === t))

console.log(`trap assertions over ${rows.length} applicable answers\n`)
for (const t of tasks) console.log(`  ${t}: ${TRAPS[t].qualifier}`)

console.log("\nvariant " + tasks.map((t) => t.padStart(12)).join("") + "        total")
for (const v of variants) {
  const cells = tasks.map((t) => {
    const rs = rows.filter((r) => r.variant === v && r.task === t && r.status !== "n/a")
    return rs.length === 0 ? "n/a" : `${rs.filter((r) => r.status === "pass").length}/${rs.length}`
  })
  const all = rows.filter((r) => r.variant === v && r.status !== "n/a")
  const pass = all.filter((r) => r.status === "pass").length
  console.log(
    `${v.padEnd(7)} ` + cells.map((c) => c.padStart(12)).join("") + `   ${String(pass).padStart(3)}/${all.length}`,
  )
}

const failures = rows.filter((r) => r.status === "FAIL")
console.log(`\n${failures.length} failures:`)
for (const f of failures) console.log(`  ${f.file}  — missing: ${TRAPS[f.task].qualifier}`)
