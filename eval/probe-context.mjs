/**
 * Probe: is "self-containment" measurable deterministically?
 *
 * prosemeter scores how a document *reads*. It cannot score whether the document *makes sense*,
 * because it never sees what the document was answering. This probe tests whether the gap can be
 * measured with counting rather than a language model.
 *
 * Not a dimension, not built, not published. It exists so the finding in
 * `docs/LIB_SPEC_context-completeness_2026-08-04.md` can be re-run and argued with.
 *
 * Usage:
 *   node eval/probe-context.mjs <file>...            # score each file alone
 *   node eval/probe-context.mjs --pair <q> <a>       # score the answer alone, then with its question
 *
 * ## The signal
 *
 * **First-mention definiteness.** "the ceiling" asserts the reader already knows which ceiling.
 * English marks shared knowledge with the definite article, so a definite noun phrase whose head
 * noun has not appeared earlier in the document is a pointer at context the document does not
 * carry. Same for the demonstratives — "this approach", "that run".
 *
 * ## Why the raw count is the wrong number
 *
 * Every answer leans on its question, and that is healthy. `fixtures/chat-clear.md` opens with
 * "the bundler" having never introduced a bundler, and it is a perfectly good answer — the question
 * introduced it. So the raw rate condemns good writing.
 *
 * **The residual is the number that matters**: what is still unbound after you supply the question.
 * That separates "needs its question" (fine, pair them) from "needs a conversation you cannot hand
 * anyone" (the actual defect).
 *
 * ## Deliberate crudeness
 *
 * No POS tagger. The head noun is the first non-stopword within two tokens of the determiner, so
 * "the very large index" resolves to "large". Absolute rates are therefore noisy and only the
 * direction of a paired comparison is worth reading. Fixing this properly needs `nlcst-*` and a
 * real noun-phrase chunker — see the spec's open questions.
 */

import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

/** Words that are never the head of a referring noun phrase, or too generic to track. */
const NOT_A_HEAD = new Set([
  "same", "other", "first", "second", "third", "last", "next", "only", "very", "most", "more", "less",
  "best", "worst", "whole", "entire", "way", "time", "thing", "things", "one", "two", "three", "point",
  "kind", "sort", "case", "fact", "reason", "answer", "question", "number", "score", "word", "words",
  "text", "line", "lines", "file", "files", "code", "result", "results", "and", "or", "but", "is",
  "was", "are", "were", "be", "been", "to", "of", "in", "on", "at", "it", "its", "they", "them",
])

const DETERMINERS = new Set(["the", "this", "that", "these", "those"])

/** Phrases that name something outside the document outright. */
const EXTERNAL =
  /\b(as (?:discussed|noted|mentioned|established|above)|see above|see below|earlier|previously|as i said|last time|the previous|we (?:decided|agreed|found) (?:earlier|before))\b/gi

/** Drop code, tables, and URLs — definiteness there is not prose. */
const strip = (raw) =>
  raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/https?:\/\/\S+/g, " ")

/** Crude lemma: lowercase, strip punctuation, fold the two commonest plurals. */
const lemma = (w) =>
  w
    .toLowerCase()
    .replace(/[^a-z-]/g, "")
    .replace(/ies$/, "y")
    .replace(/s$/, "")

/**
 * Seed the "already introduced" set from prior text — the question, or earlier turns — without
 * counting it.
 *
 * This has to be separate from concatenation. Prepending the question and scoring the whole thing
 * conflates three effects: references the question genuinely binds, unbound references the question
 * itself contributes, and the question's words inflating the denominator. Measured on the first
 * version of this probe, denominator inflation was **half** the headline effect — `chat-clear.md`
 * bound only 2 of 14 references, while its rate appeared to fall 87.0 to 61.9.
 */
const seedFrom = (prior) => {
  const introduced = new Set()
  for (const m of strip(prior).matchAll(/\b([A-Za-z][A-Za-z-]*)\b/g)) {
    const l = lemma(m[0])
    if (l.length >= 3) introduced.add(l)
  }
  return introduced
}

export const probe = (raw, prior = "") => {
  const text = strip(raw)
  const tokens = [...text.matchAll(/\b([A-Za-z][A-Za-z-]*)\b/g)]
  const total = text.split(/\s+/).filter(Boolean).length

  const introduced = seedFrom(prior)
  const unbound = []

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i][0]
    if (DETERMINERS.has(word.toLowerCase())) {
      for (let j = i + 1; j <= i + 2 && j < tokens.length; j++) {
        const head = lemma(tokens[j][0])
        if (!head || head.length < 3 || NOT_A_HEAD.has(head)) continue
        if (!introduced.has(head)) unbound.push(`${word.toLowerCase()} ${head}`)
        break
      }
    }
    const l = lemma(word)
    if (l.length >= 3) introduced.add(l)
  }

  const external = [...text.matchAll(EXTERNAL)].map((m) => m[0])

  return {
    words: total,
    unbound: unbound.length,
    per1k: (1000 * unbound.length) / Math.max(total, 1),
    external: external.length,
    samples: unbound.slice(0, 8),
  }
}

/**
 * Entry-point guard. Without it, importing `probe` runs the CLI and exits — the same mistake
 * `traps.mjs` made.
 */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

const args = isMain ? process.argv.slice(2) : []
if (isMain && args.length === 0) {
  console.error("usage: node eval/probe-context.mjs <file>...   |   --pair <question-file> <answer-file>")
  process.exit(2)
}

const name = (p) => p.split("/").slice(-1)[0]

if (!isMain) {
  // imported for its `probe` export; nothing to run
} else if (args[0] === "--pair") {
  const [, qPath, aPath] = args
  if (!qPath || !aPath) {
    console.error("--pair needs a question file and an answer file")
    process.exit(2)
  }
  const answer = readFileSync(aPath, "utf8")
  const alone = probe(answer)
  const withQ = probe(answer, readFileSync(qPath, "utf8"))
  const bound = alone.unbound - withQ.unbound
  const drop = alone.unbound === 0 ? 0 : (bound / alone.unbound) * 100

  console.log(`${name(aPath)}  —  ${alone.words} words, rate is unbound refs per 1000 words (lower is better)\n`)
  console.log(`  answer alone           ${alone.unbound} unbound  (${alone.per1k.toFixed(1)}/1k)`)
  console.log(`  question in scope      ${withQ.unbound} unbound  (${withQ.per1k.toFixed(1)}/1k)`)
  console.log(`  bound by the question: ${bound} of ${alone.unbound}  (${drop.toFixed(0)}%)`)

  /**
   * Two axes, not one. A low residual means the text already stands alone and the drop is
   * irrelevant. A high residual splits on whether the question accounts for it: if supplying the
   * question binds a good share, pairing them fixes it; if it binds nothing, the text is leaning on
   * something no reader can be handed.
   *
   * The first draft of this probe used the drop alone and flagged the one reply that had actually
   * landed, because a self-contained answer has nothing for its question to bind.
   */
  const SELF_CONTAINED = 40 // unbound/1k; below this the text introduces its own terms
  const verdict =
    withQ.per1k < SELF_CONTAINED
      ? "Self-contained. It introduces its own terms and does not need the question."
      : drop > 20
        ? "Leans on its question. Pair them and it stands alone."
        : "Leans on context that is neither in the text nor in the question — prior conversation, or nothing."
  console.log(`\n  ${verdict}`)
} else {
  console.log("file".padEnd(34), "words".padStart(6), "unbound".padStart(8), "/1k".padStart(7), "external".padStart(9))
  for (const f of args) {
    const r = probe(readFileSync(f, "utf8"))
    console.log(
      name(f).padEnd(34),
      String(r.words).padStart(6),
      String(r.unbound).padStart(8),
      r.per1k.toFixed(1).padStart(7),
      String(r.external).padStart(9),
    )
    if (args.length === 1) console.log("  " + r.samples.join(" · "))
  }
}
