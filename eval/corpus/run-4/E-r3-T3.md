---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first attempt probably worked — you just never saw the answer.

A timeout tells you nothing about what the server did. The request might have died before it reached the processor, or it might have charged the card and lost the response on the way back. Your client can't tell those two apart. So a blind retry re-runs a side effect that already happened.

Idempotency is what makes the retry safe. You generate one unique key per logical charge — per checkout attempt, not per HTTP call. You send that key on the first request and on every retry of it. The provider stores the key alongside the result, so the second request returns the original charge instead of creating a new one.

Concretely:

- Generate the key where the intent is formed (the checkout), not inside the retry loop. A key generated per attempt defeats the whole thing.
- Persist it with the order row, so a retry after a process restart reuses the same key.
- Send it as `Idempotency-Key`. Stripe, Adyen, and most processors support it.
- Retry only on timeouts, connection errors, and 5xx. A 4xx means the provider understood you and said no — retrying just repeats the rejection.

Then check your own API. If your endpoint creates a charge row, it needs the same protection: put the key in a unique index, and have the duplicate insert return the first result rather than error out.
