# Context completeness — a proposal

**Status: proposal, not built.** The evidence below is real and reproducible. The design is a
sketch. Nothing in `packages/` implements this.

## The problem

prosemeter measures how a document *reads*. It cannot measure whether the document *makes sense*,
because it never sees what the document was answering.

That gap produced a clean failure on 2026-08-04. Two replies to the same question, in this repo:

| reply | prosemeter (`chat`) | what the reader said |
| --- | --- | --- |
| first attempt | **85** | "I have no idea what you're saying" |
| plain rewrite | **84** | landed |

The tool scored the incomprehensible one *higher*. Every dimension it has — reading grade, sentence
length, jargon, hedging, structure — was blind to the thing that actually broke.

## What actually broke

The first reply used "the ceiling", "the floor", and "the composite" as if the reader knew them.
Those terms were invented earlier in the same conversation, over several hours. The reader had them
when we coined them. **By the next day they were gone.**

The words were all plain. The sentences were all short. The reader understood every sentence and
none of the argument.

## Three scales of the same failure

Readability is a property of the text. Comprehensibility is a property of the text *plus* what the
reader already holds. That second term decays in at least three ways:

1. **A new reader.** Someone joining a conversation understands the words and not the subject.
2. **The same reader, later.** Shared context has a half-life. Yesterday's coinages are today's
   jargon — this is the one that produced the failure above, and it is the easiest to miss, because
   the author's own context has not decayed.
3. **An answer separated from its question.** A one-shot answer carries only half the pair. The
   question supplied nouns the answer then refers to as given.

Scale 3 is the tractable one, and it turns out to discriminate between 1 and 2 as a side effect.

## The measure

**First-mention definiteness.** English marks shared knowledge with the definite article. Writing
"*the* ceiling" asserts the reader already knows which ceiling. If the head noun never appeared
earlier in the document, that article points at context the document does not carry. Demonstratives
behave the same way — "this approach", "that run".

This is countable. No language model required, which keeps it inside prosemeter's determinism
constraint.

### The raw count needs the question subtracted from it

Every answer leans on its question, and that is healthy. `fixtures/chat-clear.md` opens with "the
bundler" having never introduced a bundler, and it is a good answer — the *question* introduced it.
Scored alone it looks worse than the reply nobody could follow.

So the question has to be in scope before the count means anything. What survives that is the
**residual**.

### Measured

`eval/probe-context.mjs`. The count is unbound references; the rate is per 1,000 words. **Lower is
better** — this counts problems, unlike every prosemeter dimension, where 100 is good.

| document | unbound, alone | rate | with the question in scope | bound |
| --- | --- | --- | --- | --- |
| `fixtures/chat-clear.md` | 10 in 161 words | 62.1 | 9 | 1 of 10 |
| first reply (scored 85) | 28 in 458 words | **61.1** | 28 | 0 of 28 |
| plain rewrite (scored 84) | 8 in 314 words | **25.5** | 8 | 0 of 8 |

The load-bearing comparison is the last two rows: **28 unbound references against 8** — same author,
same content, same hour, one comprehensible and one not. A 2.4x gap in a measure that reading grade,
sentence length, jargon, and hedging all missed.

**The question binds almost nothing**, here or at corpus scale (1.7 of 18.2 across 326 answers). The
"supply the question and watch it improve" framing this document opened with is not supported. What
survives is the raw count with the question in scope — the question matters as a *seed*, not as a
lever.

An earlier draft of this section claimed the measure fails in general, on the grounds that
`chat-clear.md` (68.3, good) and the incomprehensible reply (69.9, bad) are indistinguishable. **That
comparison was invalid** — different questions, different registers. It is the same across-task-set
error `eval/compare.mjs` exits 2 to prevent. Compare within a pair and both separate.

**The probe prints no verdict.** An earlier version classified documents on two thresholds fitted to
these three; both moved when the extraction was fixed, which is the tell that they were fitted to
noise. Calibration needs labelled documents and none exist.

### Two method errors, both caught by running it

**The verdict cannot use the bound percentage alone.** The first version did, and flagged the reply
that had actually landed — a self-contained answer has nothing left for its question to bind, so it
scores 0% exactly like the worst case does.

**The question must seed the introduced set, not be concatenated onto the text.** Prepending it
conflates three effects: references it genuinely binds, unbound references it contributes itself, and
its own words inflating the denominator. That last one was **half** the originally reported effect —
`chat-clear.md` appeared to improve 87.0 to 61.9, a "29% drop", when the honest figure is 3
references of 14. Under concatenation the other two documents' raw counts went *up*. `probe()` now
takes `prior` as a separate argument, counted for what it introduces and nothing else.

## Granularity: document-level score, per-block findings

A reader does not average a document. They read linearly and stop at one place. That argues for
scoring blocks rather than the whole body — and for aggregating by the worst block, since one
impenetrable paragraph sinks a reply whose average is fine.

**Tested, and the aggregation half is wrong.** Each document split on blank lines, each block scored
with the reader's real state at that point (the question plus every preceding block), against two
labelled pairs:

| statistic | chat pair, good → bad | reply pair, good → bad | separates both? |
| --- | --- | --- | --- |
| whole document | 68.3 → 72.2 | 28.7 → 69.9 | **yes** |
| mean of blocks | 60.4 → 69.2 | 39.7 → 69.1 | yes |
| **worst block** | 107.1 → 111.1 | 130.4 → 135.1 | yes, by 4 and 5 points |
| 75th percentile | 100.0 → 92.6 | 62.5 → 129.0 | **no** |

The worst block barely discriminates, because short blocks make rates unstable — a 12-word paragraph
with two unbound references scores 167 per 1,000. The maximum finds the shortest dense block in any
document, good or bad.

**Where per-block wins is locating the failure.** The worst block in the reply that failed was its
opening paragraph — the one the reader actually stopped at. No document-level number can say that.

So: **document-level for the score, per-block for the findings.** That matches every other dimension
here, which emits a located finding precisely so the fix is obvious.

## At corpus scale

326 eval answers whose question is known, scored with the question in scope:

| | value |
| --- | --- |
| mean rate | 45.1 unbound per 1,000 words |
| sd **within** a task (answer-level) | **9.3** |
| sd **between** task means (topic) | 5.9 |
| ratio | **1.58** |

Above 1 means individual answers differ more than topics do, so there is answer-level signal and the
measure is not merely a topic detector. Answers to T1 span 24.5 to 86.6 — a 3.5x range on one
question.

**The instruction does not control it, and slightly worsens it.** No-instruction control 40.6, the
shipped rules 49.8. Cutting length raises the density of definites without changing how many terms
go unintroduced. Like `clarity`, this is a document check and not an instruction dial.

## What it would take to ship

Not a new dimension. **A new input.**

Every `DimensionProvider` today receives `(ParsedDocument, DimensionSettings)`. Self-containment
needs a second document — the question, or the prior turns — and nothing in the current shape can
carry one. That is an API change across `@prosemeter/core`, every scorer package, the CLI, and the
MCP tools.

Sketch, deliberately thin:

```ts
score(text, { profile: "chat", context: { question: "...", prior: [...] } })
```

with a `self-containment` dimension that reports the residual and emits a finding per unbound
reference, located, so the fix is "introduce this term or cut it".

## Open questions

- **The head-noun extraction is the bottleneck, and it needs a POS tagger.** The first version took
  the first non-stopword after the determiner, so it reported the adjective: over 326 answers the
  three most-flagged "heads" were `old` (77), `new` (48), and `right` (29), plus `the` itself (15)
  from a parsing bug. Those scale with descriptive writing, not with context dependence.

  English noun phrases are head-final, so the probe now scans forward and takes the last word still
  inside the phrase. That removed the adjectives. **Roughly a third of the flags are still noise** —
  `doesn` and `isn` from contractions, `down`/`again`/`back`/`here` from particles.

  The signal improved as the noise fell: the within/between ratio went 1.38 to 1.58 on the same
  corpus. That is the argument for going further with `retext-pos` (v5, same retext family already
  in use) rather than extending a hand-built stop list, which is the mistake `HEDGE_IGNORE_DEFAULT`
  documents.
- **The 40-per-1k self-contained threshold is one observation, not a calibration.** Three documents
  set it. It needs a corpus.
- **Generic definites are false positives, and they dominate.** Run the probe on this document and
  it returns 73.7 unbound/1k — worse than the reply nobody could follow. The first eight flags are
  `the evidence · the design · the problem · that gap · this repo · the tool · the incomprehensible ·
  that actually`. Every one is either an abstract noun that is definite by convention or an artifact
  of taking the word after the determiner. The stopword list papers over some of this and will not
  scale. **Until this is fixed the absolute rate means nothing across documents** — only the paired
  before/after comparison on one document is load-bearing, because the false positives cancel.
- **Is the score the right shape?** The rate is per 1,000 words and lower is better, which inverts
  every other dimension, where 100 is good. Shipping it would need a normalization strategy.
- **The block minimum is unset.** Blocks under ~12 words produce unusable rates. Findings should
  probably be suppressed below some floor rather than reported as catastrophic.
- **Prior turns, not just the question.** Scale 2 is the failure that prompted this, and the probe
  only tests scale 3. Feeding N prior turns and watching the residual fall is the direct test and
  has not been run.

## Why this is worth more than another readability dimension

The existing fifteen dimensions all measure the same kind of thing: local properties of the prose.
They are correlated with each other and they saturate — `grade-band` scores exactly 100 on 87.5% of
the eval corpus.

This measures a different kind of thing. It is the only candidate so far that would have caught the
2026-08-04 failure, and that failure is the most common real complaint about agent writing: not that
it is hard to read, but that it assumes you were there.
