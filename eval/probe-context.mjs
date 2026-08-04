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
 *   node eval/probe-context.mjs --blocks <a> [q]     # per-block findings, which paragraph assumes what
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

/**
 * Words that end a noun phrase. Anything at or after one of these is not part of the NP, so the
 * head is whatever preceded it.
 */
const ENDS_NP = new Set([
  // prepositions and conjunctions
  "of", "in", "on", "at", "to", "for", "with", "from", "by", "as", "into", "over", "under", "after",
  "before", "between", "through", "during", "without", "within", "and", "or", "but", "so", "than",
  "because", "if", "when", "while", "that", "which", "who", "where",
  // auxiliaries and very common verbs — a determiner phrase stops at the predicate
  "is", "are", "was", "were", "be", "been", "being", "has", "have", "had", "does", "do", "did",
  "will", "would", "can", "could", "should", "must", "may", "might",
  "gives", "give", "picks", "pick", "holds", "hold", "sees", "see", "makes", "make", "gets", "get",
  "goes", "go", "runs", "run", "calls", "call", "uses", "use", "takes", "take", "keeps", "keep",
  "means", "mean", "needs", "need", "points", "point", "works", "work", "fails", "fail", "wins",
  "win", "comes", "come", "lets", "let", "puts", "put", "shows", "show", "says", "say", "starts",
  "start", "stops", "stop", "adds", "add", "returns", "return", "sets", "set", "hoists", "hoist",
  "resolves", "resolve", "matches", "match", "wants", "want", "asks", "ask", "still", "then", "also",
])

/**
 * The head of the noun phrase beginning at `i` (a determiner).
 *
 * English noun phrases are **head-final**: "the old version" is about a version, not about
 * oldness. The first version of this took the first non-stopword after the determiner and so
 * reported the adjective. Over 326 eval answers the three most-flagged "heads" were `old` (77),
 * `new` (48), and `right` (29) — all adjectives, and all of them scaling with descriptive writing
 * rather than with context dependence. `the` itself was flagged 15 times.
 *
 * Scans forward at most 4 tokens, stops at anything that ends a noun phrase, and returns the last
 * word still inside it.
 */
const headOf = (tokens, i) => {
  let head = null
  for (let j = i + 1; j <= i + 4 && j < tokens.length; j++) {
    const w = tokens[j][0].toLowerCase()
    if (ENDS_NP.has(w) || DETERMINERS.has(w)) break
    const l = lemma(tokens[j][0])
    if (!l || l.length < 3) break
    head = l
  }
  return head && !NOT_A_HEAD.has(head) ? head : null
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
      const head = headOf(tokens, i)
      if (head && !introduced.has(head)) unbound.push(`${word.toLowerCase()} ${head}`)
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
 * Split into the units a reader actually stops at: paragraphs, list blocks, headings. Blocks under
 * `MIN_BLOCK_WORDS` are skipped — a 12-word paragraph with two unbound references scores 167 per
 * 1000, which is noise, not a finding.
 */
const MIN_BLOCK_WORDS = 12

export const blocks = (raw) =>
  raw
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.split(/\s+/).filter(Boolean).length >= MIN_BLOCK_WORDS)

/**
 * Score each block with the reader's real state at that point: the question plus every block they
 * have already read. This is where the findings come from.
 *
 * The document rate stays the score. Aggregating blocks by the *worst* one was tested and rejected:
 * against two labelled pairs it separated good from bad by 4 and 5 points, where the document rate
 * separated them by 4 and 41. Short blocks make the maximum unstable, so it finds the shortest dense
 * block in any document rather than the hardest one.
 */
export const perBlock = (raw, prior = "") => {
  let seen = prior
  return blocks(raw).map((b) => {
    const r = probe(b, seen)
    seen += "\n\n" + b
    return { words: r.words, unbound: r.unbound, rate: r.per1k, refs: r.samples, excerpt: b.slice(0, 60).replace(/\s+/g, " ") }
  })
}

/**
 * Entry-point guard. Without it, importing `probe` runs the CLI and exits — the same mistake
 * `traps.mjs` made.
 */
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

const args = isMain ? process.argv.slice(2) : []
if (isMain && args.length === 0) {
  console.error("usage: probe-context.mjs <file>...  |  --pair <q> <a>  |  --blocks <a> [q]")
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
   * No verdict is printed, deliberately.
   *
   * An earlier version classified into self-contained / needs-its-question / needs-a-conversation on
   * two thresholds fitted to three documents. Both moved when the head-noun extraction was fixed —
   * `chat-clear.md` went from 3 of 14 references bound to 1 of 10 — which is the tell that they were
   * fitted to extraction noise rather than to anything about the prose.
   *
   * Calibrating them needs labelled documents, and none exist. Report the counts; let the reader
   * judge.
   */
} else if (args[0] === "--blocks") {
  const [, aPath, qPath] = args
  const raw = readFileSync(aPath, "utf8")
  const prior = qPath ? readFileSync(qPath, "utf8") : ""
  const doc = probe(raw, prior)
  console.log(`${name(aPath)}  —  document score ${doc.per1k.toFixed(1)} unbound/1k (${doc.unbound} in ${doc.words} words)\n`)
  console.log("block   words   unbound   rate   excerpt")
  perBlock(raw, prior).forEach((b, i) => {
    console.log(
      String(i + 1).padStart(5),
      String(b.words).padStart(7),
      String(b.unbound).padStart(9),
      b.rate.toFixed(0).padStart(6),
      "  " + b.excerpt + "...",
    )
    if (b.unbound > 0) console.log(" ".repeat(31) + "^ " + b.refs.join(" · "))
  })
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
