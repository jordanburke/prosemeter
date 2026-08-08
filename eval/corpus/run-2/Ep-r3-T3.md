---
kind: eval-artifact
run: 2
variant: Ep
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired after a charge that already succeeded. The client never learned it succeeded, so it retried a request the server had already completed.

The usual shape is a timeout. Your service posts a charge, the processor takes the money and starts writing its response, and the network drops or your client hits its deadline before the response lands. Your code sees a failure and retries. The processor sees a brand-new charge request and charges again. Nothing malfunctioned — the client and server just disagreed about what happened, and a retry resolved that disagreement in the wrong direction.

This is why a failed response is ambiguous in a way a failed request isn't. A connection refused means nothing happened. A timeout means you don't know.

Idempotency removes the ambiguity. You attach a key you generate — a UUID — to the charge request, and you reuse that same key on every retry of that same charge. The processor stores the key with the result of the first request. When the retry arrives with a key it has seen, it returns the stored result instead of charging again. The retry becomes safe because the second call can't do new work.

Three things to get right:

- **Generate the key at the point the user acts,** not inside the retry loop. A key generated per attempt is a new key each time, which defeats the whole thing.
- **Persist the key with your order record** before you send the request. If your own process dies and restarts mid-retry, it needs to recover the same key.
- **Check what your processor already gives you.** Stripe, Adyen, and most others accept an `Idempotency-Key` header. You may not need to build anything.

Watch the expiry window. Most processors keep idempotency keys for 24 hours or so, and a retry after that window charges again. If your retries can span longer than that — a job that requeues for days — you need your own record of what you've charged, not just the processor's.

And retry on timeouts and 5xx only. A 4xx means the processor understood you and refused; retrying that just burns rate limit.
