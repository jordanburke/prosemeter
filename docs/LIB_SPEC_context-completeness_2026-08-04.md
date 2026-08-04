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
| `fixtures/chat-clear.md` | 14 in 161 words | 87.0 | 11 | **3 of 14 (21%)** |
| first reply (scored 85) | 32 in 458 words | **69.9** | 32 | **0 of 32** |
| plain rewrite (scored 84) | 9 in 314 words | **28.7** | 9 | 0 of 9 |

The load-bearing comparison is the last two rows: **32 unbound references against 9** — same author,
same content, same hour, one comprehensible and one not. A 2.4x gap in a measure that reading grade,
sentence length, jargon, and hedging all missed.

**But the measure does not yet separate good from bad in general.** With its question in scope
`chat-clear.md` sits at 68.3 per 1,000 words and the incomprehensible reply at 69.9 — indistinguishable,
and `chat-clear.md` is a good answer. A short answer to a context-heavy question has a naturally high
density of definites. So what the probe currently separates is *"introduces its own terms"* from
*"does not"*, which is narrower than *"comprehensible"* and may only look like it on this one pair.
Treat the 2.4x as a lead, not a result.

Two axes decide the verdict:

- **Few unbound to begin with** — the text introduces its own terms and needs nothing. (plain rewrite)
- **Many, and the question binds a share** — needs its question. Fine; pair them. (chat-clear)
- **Many, and the question binds none** — needs something in neither. **This is the defect.** (first reply)

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

- **The head-noun extraction is crude.** No POS tagger; the head is the first non-stopword within
  two tokens of the determiner, so "the very large index" resolves to "large". Absolute rates are
  noisy and only paired comparisons are worth reading. A real fix needs an `nlcst` noun-phrase
  chunker.
- **The 40-per-1k self-contained threshold is one observation, not a calibration.** Three documents
  set it. It needs a corpus.
- **Generic definites are false positives, and they dominate.** Run the probe on this document and
  it returns 73.7 unbound/1k — worse than the reply nobody could follow. The first eight flags are
  `the evidence · the design · the problem · that gap · this repo · the tool · the incomprehensible ·
  that actually`. Every one is either an abstract noun that is definite by convention or an artifact
  of taking the word after the determiner. The stopword list papers over some of this and will not
  scale. **Until this is fixed the absolute rate means nothing across documents** — only the paired
  before/after comparison on one document is load-bearing, because the false positives cancel.
- **Does it survive the eval corpus?** 416 answers are on disk. Nobody has run this over them.
- **Is the residual stable across task registers?** Every other metric here was measured for that
  and `words` failed it. Assume this one fails until shown otherwise.
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
