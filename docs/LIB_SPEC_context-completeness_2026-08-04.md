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

### The raw count is the wrong number

Every answer leans on its question, and that is healthy. `fixtures/chat-clear.md` opens with "the
bundler" having never introduced a bundler, and it is a good answer — the *question* introduced it.
Scored alone it looks worse than the reply nobody could follow.

**The residual is the number that matters**: what is still unbound after the question is supplied.

### Measured

`eval/probe-context.mjs`, rate is unbound references per 1,000 words:

| document | alone | with its question | bound by the question | reading |
| --- | --- | --- | --- | --- |
| `fixtures/chat-clear.md` | 87.0 | 61.9 | **29%** | leans on its question; pair them and it stands |
| first reply (scored 85) | 69.9 | 69.2 | **1%** | leans on neither the text nor the question |
| plain rewrite (scored 84) | 28.7 | 30.0 | −5% | already self-contained; nothing left to bind |

Two axes, not one:

- **Low residual** — the text introduces its own terms. The drop is irrelevant. (plain rewrite)
- **High residual, large drop** — needs its question. Fine; pair them. (chat-clear)
- **High residual, no drop** — needs something that is in neither. **This is the defect.** (first reply)

The first version of the probe used the drop alone and flagged the reply that had actually landed,
because a self-contained answer has nothing for its question to bind. That mistake is why the
threshold logic uses both axes.

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
