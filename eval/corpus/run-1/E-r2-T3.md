---
kind: eval-artifact
run: 1
variant: E
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "'Do not retry on 4xx.' Overbroad; 429 and 408 are retryable."
---
Your retry fired after the first charge already succeeded. The failure you saw was in the response, not in the charge.

The usual shape: your service posts a charge, the processor takes the money, and then the connection times out or the load balancer drops the reply. Your code sees an error and retries. The processor gets a second request that looks brand new, so it charges again. A timeout tells you nothing about whether the work happened — only that you stopped hearing about it.

Idempotency is the fix. An idempotent operation gives the same result whether you run it once or ten times. You get it by attaching a key that identifies *the intent*, not the attempt:

1. **Generate an idempotency key before the first attempt.** Use a UUID tied to the checkout, the cart, or the order — something stable.
2. **Send the same key on every retry.** Do not generate a new one inside the retry loop. That is the most common way this breaks.
3. **Let the server dedupe.** Stripe, Adyen, and most processors store the key with the original response. A repeat request returns that stored response instead of charging again.

Two details that bite people:

- **The key must cover the whole retry chain**, including retries after a process restart. Store it with the order row, not in memory.
- **Retry only what is safe.** Retry on timeouts, 5xx, and connection resets. Do not retry on 4xx — the request was rejected, and sending it again just wastes a call.

If your processor does not support idempotency keys, build the dedupe yourself. Write a row keyed on the intent before you call out, mark it as in-flight, and have retries check that row first. Reconcile in-flight rows against the processor afterward, since some of them did go through.

Also add backoff with jitter to the retries. That does not prevent duplicates, but it stops a slow processor from turning into a stampede while you fix the real problem.
