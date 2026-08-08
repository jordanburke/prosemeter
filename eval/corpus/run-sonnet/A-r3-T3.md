---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired a second charge because the payment operation wasn't idempotent — the server had no way to tell "this is a retry of an earlier request" from "this is a new charge."

Here's the failure sequence: the client sends a charge request, the server processes it and charges the card, but the response never makes it back (timeout, dropped connection, whatever). The client doesn't know if the charge happened. It only knows it didn't get a confirmed answer. So it retries. The server sees a brand-new request and charges the card again. From the server's side, both requests looked identical and legitimate — nothing told it they were the same logical operation.

Idempotency fixes this by giving each *logical* operation a stable identity, separate from the network attempt:

1. The client generates a unique idempotency key per operation (a UUID, generated once, before the first attempt) — not per HTTP request.
2. Every retry of that same operation sends the same key.
3. The server stores completed operations keyed by that value, with a unique constraint in the database so two concurrent attempts can't both win.
4. On each request, the server checks: have I seen this key before? If yes, return the stored result instead of charging again. If no, process it and store the result under that key.

The database constraint matters — a check-then-charge without a unique constraint just moves the race condition instead of closing it.

For the retry logic itself: keep the backoff, but make sure it's retrying with the same idempotency key each time, not generating a fresh one per attempt.
