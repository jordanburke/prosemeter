---
kind: eval-artifact
run: 1
variant: C
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "'A 4xx means the server heard you and said no.' Tells the reader to give up on 429, the canonical retry-with-backoff signal."
---
Your retry fired on a timeout. But a timeout tells you nothing about what the server did. The charge very likely went through, and only the reply died on the way back. So you retried a call that had already worked.

That is the whole bug. The network can lose the answer without losing the request. Your code cannot tell those two cases apart, and it guessed wrong.

Idempotency closes the gap by giving each charge a name. You mint one key per charge you *intend* — not per attempt — and send that same key on every try. The payment provider stores the key next to the result. When a second call shows up with a key it has seen, it hands back the first result instead of charging again.

With Stripe that is the `Idempotency-Key` header. Same key, same response, one charge.

**Rules that actually matter:**

- **Mint the key before the first call** and save it on your order row. If you generate it inside the retry loop, each try gets a new key and you have rebuilt the same bug with extra steps.
- **One key per real charge.** A second, genuine charge for the same user needs a fresh key, or the provider will hand back the old result and no money moves.
- **Retry only on timeouts, 5xx, and connect errors.** A 4xx means the server heard you and said no. Retrying that just burns rate limit.
- **Back off with jitter and cap the tries.** Tight retry loops turn one slow call into an outage.
- **Watch the window.** Stripe holds keys for 24 hours. A retry the next day is a brand new charge.

Do the same on your own API if it takes charge requests. Accept a key from the caller, write it into a column with a unique constraint, and let the DB reject the dupe for you. That way the guard holds even when two workers race.
