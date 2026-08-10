---
kind: eval-artifact
run: 6
variant: P
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your retry charged the card twice because a failed request is not a failed charge. The first attempt almost certainly succeeded at the processor and failed on the way back to you.

## What went wrong

A charge request crosses a network. It can break in three places, and from the client all three look the same.

1. The request never arrived. No charge happened. Retrying is correct.
2. The request arrived, the processor charged the card, and the response was lost — a timeout, a dropped connection, a load balancer killing an idle socket. The charge happened. Retrying charges again.
3. The request arrived, the charge succeeded, and your own code crashed before recording it. Same outcome as case 2.

Your client sees a timeout in all three. It cannot tell them apart, so it retries, and in cases 2 and 3 that makes a second real charge.

Retrying more carefully does not fix this. You cannot distinguish "not done" from "done, but I did not hear about it" using the network alone. Timeouts make it worse, because the request that timed out is often the one still in flight and about to succeed.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. Reading a row is idempotent by nature. Charging a card is not — two charges take twice the money.

An idempotency key makes a non-idempotent operation behave like an idempotent one. You generate a unique key for each *logical* charge, not for each HTTP attempt, and send it with the request. The processor stores the key next to the result. When a request arrives with a key it has already seen, it skips the charge and returns the stored result.

Now the retry is safe. Case 1 has no stored key, so the retry charges once. Cases 2 and 3 do, so the retry returns the original charge. All three end with exactly one charge.

## How to implement it

**Generate the key at the top of the operation, before the first attempt.** This is the part people get wrong. Generate it inside the retry loop and every attempt carries a fresh key, which puts you back where you started. The key stands for the customer's intent to pay, so create it when that intent forms — the user clicks Pay, or the order row is written — and reuse it for every attempt, including a retry minutes later after a process restart.

**Make the key deterministic, or store it.** A UUID persisted with the order works. So does a derived key such as `order-{id}-attempt-{n}`, where `n` changes only when the user genuinely starts a new payment. What must never happen is the key being regenerated for the same logical payment.

**Use the processor's mechanism.** Stripe takes an `Idempotency-Key` header; PayPal, Adyen, and Square have equivalents. Check the retention window — Stripe's is 24 hours — because a retry after the window expires is a fresh charge again. That matters for any job retrying with long backoff.

**Do the same in your own service.** Your API needs the protection the processor's has, or a client retry against you creates two charge attempts with two different keys. Accept an idempotency key on the payment endpoint, store it under a unique constraint, and return the original response on a repeat. The unique constraint is what keeps it safe under concurrency: two simultaneous retries race, and one must lose at the database rather than both proceeding.

**Handle the in-flight duplicate.** If a second request arrives while the first is still running, do not start a second charge. Return 409, or wait on the first. Storing the key *before* performing the charge, not after, is what makes that possible.

## Two things to check next

**Reconcile against the processor.** Idempotency keys reduce duplicates; a daily job comparing your charge records to the processor's catches the ones that slip through. You need that job anyway, for the case where your database write failed after a successful charge.

**Retry only what is retryable.** A 400 or a card decline will never succeed on retry, and retrying it burns budget and can trip fraud rules. Retry timeouts, connection failures, 429s, and 5xx, with exponential backoff and jitter so a processor blip does not become a stampede.
