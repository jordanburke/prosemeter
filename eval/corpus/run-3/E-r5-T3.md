---
kind: eval-artifact
run: 3
variant: E
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge because the first one probably succeeded. A failed response is not a failed operation.

Walk the timeline. You send the charge. The processor takes the money and writes the record. The response comes back to you — but the connection drops, or your client times out at 10 seconds while the processor took 12. Your code sees an error and retries. The processor sees a brand new charge request and takes the money again. Nothing malfunctioned. Both sides did exactly what they were told.

The gap is that a network error tells you nothing about what happened on the far side. You cannot tell "never arrived" from "arrived, worked, reply lost." Retrying is right for the first case and wrong for the second, and you cannot see which one you are in.

Idempotency closes that gap. You attach a key to the request — a UUID you generate once, before the first attempt:

```
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

The processor stores that key with the result of the operation. When the same key arrives again, it skips the work and replays the stored response. Same key, same answer, one charge. Every retry of that attempt reuses the key.

Three rules make it actually work.

**Generate the key at the top, not in the retry loop.** If you mint a new UUID per attempt, you have written a fresh charge each time and gained nothing. Tie the key to the business intent — this user paying this invoice.

**Persist the key before you send.** If your process crashes mid-request and comes back with a new key, you are exposed again. Write it to your database first, then call out.

**Retry only what is safe.** Timeouts and 5xx are retryable. A 4xx is the server saying "this request is wrong," so retrying it just wastes calls. Use exponential backoff with jitter so a blip does not turn into a thundering herd.

Stripe, Adyen, and Square all support idempotency keys. Check your processor's docs for how long they retain a key — usually 24 hours, sometimes less — and make sure your retry window fits inside it.
