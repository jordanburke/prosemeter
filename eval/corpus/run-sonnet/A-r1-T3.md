---
kind: eval-artifact
run: sonnet
variant: A
replicate: r1
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Retrying a non-idempotent charge request causes duplicate charges, and that's exactly what happened here.

The sequence: your client sent a charge request, the server processed it and actually charged the card, but the response never made it back — timeout, dropped connection, whatever. Your retry logic saw "no response" and treated that as failure, so it retried. The server has no way to know this new request is "the same" charge as before, so it processes it as a brand new one. Card gets charged twice.

Idempotency is the fix: give every *logical* charge attempt a unique key, generated once by the client before the first try, and reused on every retry of that same attempt.

Server side, before charging:
- Look up the key.
- If you've seen it before, return the stored result — don't charge again.
- If not, do the charge and store the key -> result together, atomically with the charge itself (same transaction, or a unique constraint on the key column).

Practical notes:
- Generate the key once per checkout attempt, not once per HTTP request — otherwise each retry gets a fresh key and you're back to square one.
- Pass it as a header (`Idempotency-Key`) or in the payload.
- If you're using a payment provider like Stripe, use their built-in idempotency-key support for the charge call — don't build this yourself when the provider already handles the atomicity correctly.
