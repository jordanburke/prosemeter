---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired on requests that had already succeeded. The charge went through, the response got lost on the way back, and your client saw a timeout and tried again.

This is the core problem with retries over a network. A failure tells you the response did not arrive. It does not tell you the work did not happen. A timeout, a dropped connection, and a 502 from a proxy all look identical to the caller, and in every one of those cases the payment processor may have already moved the money.

Idempotency closes that gap. You send a key with the request — a UUID you generate once, before the first attempt, and reuse on every retry of that same logical charge. The processor records the key with the result. When it sees the key again, it returns the stored result instead of charging again. Retries become safe because the second call is a lookup, not a new charge.

Three things to get right:

- **Generate the key at the top of the operation**, not inside the retry loop. A fresh key per attempt defeats the whole thing.
- **Derive it from something stable** if you can — order ID, cart ID, invoice ID. Then even a process crash and restart produces the same key.
- **Persist it before you call out.** Write the key to your database first, so a crash between the call and the response leaves you able to resume with the same key.

Stripe, Adyen, and most processors already support this header. Turn it on before you touch the retry logic, because tuning backoff does not fix the underlying race.
