---
kind: eval-artifact
run: 4
variant: Et
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired on a request that had already succeeded. A timeout does not mean the charge failed — it means you stopped hearing about it. The charge went through, the response got lost on the way back, and your client retried a completed operation.

This is the core problem with retrying anything that changes state. The client cannot tell "never happened" apart from "happened, reply lost." Those need opposite responses, and they look identical from the outside.

**Idempotency closes the gap.** You send a key with the request — a UUID you generate once, before the first attempt. Every retry of that same logical charge carries the same key. The server stores the key alongside the result of the operation. On a repeat key, it skips the work and returns the stored result. Now retrying is safe, because the second call cannot create a second charge.

Three details decide whether it actually works:

- **Generate the key before the first attempt, not inside the retry loop.** A key made per attempt is just a random value and buys you nothing. This is the mistake I see most.
- **Write the key and the charge in one transaction.** If you insert the charge and then record the key, a crash between them leaves you exposed to the same double-charge on the next retry.
- **Pick the key from something stable in your domain** if you can — order ID plus attempt intent, say. That way a client crash and restart still lands on the same key.

Every real payment API supports this. Stripe takes an `Idempotency-Key` header and holds the result for 24 hours. Use it on every write call, not just the ones you plan to retry, because your HTTP client will retry on its own when you are not looking.

Add backoff with jitter while you are in there. Idempotency makes retries safe; backoff keeps them from turning a slow processor into a dead one.
