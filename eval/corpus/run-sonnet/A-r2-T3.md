---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Here's what likely happened: your client sent a charge request, the server processed it and charged the card, but the response never made it back — the connection dropped, or the client hit a timeout first. Your retry logic saw "no response" and assumed "no charge happened," so it sent the request again. The server had no way to tell this was the same charge, so it processed it again too. Same failure mode can repeat on the second retry, and now you've charged the customer three times for one purchase.

The bug isn't the retry — retries are correct behavior on a timeout, since you genuinely don't know if the first request landed. The bug is that the server treats "same request, sent twice" as "two separate charges."

Idempotency fixes exactly this gap. The client generates a unique idempotency key per *logical* charge attempt (a UUID, generated once, before the first try) and sends it with every retry of that same charge. The server checks: have I seen this key before?

- First time: process the charge, store the result against that key.
- Any retry with the same key: skip processing, return the stored result.

This makes the operation safe to retry as many times as needed, because retrying no longer means "do it again" — it means "tell me what happened last time." Stripe, for example, does this natively via an `Idempotency-Key` header.

Two things to get right:
- The key has to be generated once per charge attempt, on the client, before the first request — not regenerated on each retry, or you're back to square one.
- The server needs to store the key durably (not in memory) and it needs a uniqueness constraint on it in the database, so two concurrent requests with the same key can't both slip through and double-charge anyway.
