---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The bug is in an assumption your retry logic is making: that a failed request means nothing happened. It doesn't.

When your call to the payment provider times out, or the connection drops, or you get a 502, you've learned exactly one thing — **you didn't get a response**. You have learned nothing about whether the charge went through. The request may have been dropped before it arrived, or it may have been fully processed and the response got lost on the way back. From your side those two cases look identical.

Your retry treats them as the same. The provider doesn't. So the sequence is:

1. You POST a charge for $50.
2. Provider processes it. Card is charged.
3. Response is lost — network blip, load balancer timeout, whatever.
4. Your client times out and retries.
5. Provider sees a brand new, perfectly valid charge request for $50 and processes it. Card is charged again.

Nothing malfunctioned. Every component did exactly what it was told.

**Idempotency** is the property that makes retrying safe: doing the operation N times has the same effect as doing it once. `DELETE /users/42` is naturally idempotent — delete it twice, it's still just deleted. "Charge this card $50" is inherently *not*, because the whole point is a state change that accumulates.

Since you can't make the operation naturally idempotent, you make it idempotent by identity. The client generates a unique key per logical operation and sends it with the request:

```
POST /charges
Idempotency-Key: 8f14e45f-ea2b-4c94-9b1c-3d7a2e6f0c11
```

Server side: before doing the work, try to record that key. If it's new, process the charge and store the response against the key. If it already exists, don't process anything — return the stored response from the first attempt. The retry gets the same charge ID back and the caller can't tell the difference, which is the point.

Three details that matter a lot in practice:

**The key must be generated once, at the start of the logical operation, and reused across every retry of that same operation.** If your retry loop generates a fresh key each attempt, you've built exactly what you have now with extra steps. Generate it where the user clicks "Pay," not inside the retry wrapper.

**Enforce it with a database unique constraint, not a read-then-write.** `if (!exists) insert` has a race window, and under retries you'll hit it — that's precisely when two identical requests arrive concurrently. Let the unique index on the key be the arbiter and handle the conflict.

**Store the response, not just the key.** Otherwise the retry gets "already processed" and your caller has no charge ID to work with, which usually turns into a different bug downstream.

Most payment providers already support this — Stripe, Adyen, Braintree all take an idempotency key header. If you're calling one of them, you may just need to start sending it. Check whether the provider already deduped for you and the duplicate came from somewhere else in your own stack.

Two other things worth fixing while you're in there: add exponential backoff with jitter so retries don't stampede, and cap the retry count. And be deliberate about *what* you retry — a 500 or a timeout is worth retrying, a 400 never is.
