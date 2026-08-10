---
kind: eval-artifact
run: 6
variant: R
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your retry logic charged the card twice, because a failed request is not a failed charge. The first attempt succeeded at the payment processor and failed on the way back to you.

## What went wrong

A charge request crosses a network. It can break in three places, and from the client all three look identical:

1. The request never arrived. No charge happened. Retrying is correct.
2. The request arrived, the processor charged the card, and the response was lost — a timeout, a dropped connection, a load balancer killing an idle socket. The charge happened. Retrying charges again.
3. The request arrived, the charge succeeded, and your own code crashed before recording it. Same outcome as case 2.

Your client sees a timeout in all three cases. It cannot tell them apart, so it retries. In cases 2 and 3 that produces a second real charge.

No amount of careful retrying fixes this. It is a property of distributed systems. The network alone cannot separate "not done" from "done, but I did not hear about it". Timeouts make it worse. The request that timed out is the one still in flight and about to succeed.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. Reading a row is idempotent. Charging a card is not, because two charges take twice the money.

Idempotency keys make a non-idempotent operation behave like an idempotent one. You generate a unique key for each *logical* charge — not for each HTTP attempt — and send it with the request. The processor records the key alongside the result. A request arriving with a key the processor has already seen does not charge again. The processor returns the stored result of the original.

Now the retry is safe. Case 1 has no stored key, so the retry charges once. Cases 2 and 3 have one, so the retry returns the original charge. In all three cases exactly one charge exists.

## How to implement it

**Generate the key at the top of the operation, before the first attempt.** This is the part people get wrong. Generate the key inside the retry loop and every attempt gets a fresh key, which puts you back where you started. The key identifies the customer's intent to pay. Create it when that intent forms — when the user clicks Pay, or when the order row is created. Reuse it for every attempt, including a retry minutes later after a process restart.

**Make the key deterministic, or store it.** A UUID persisted alongside the order works. So does a derived key such as `order-{id}-attempt-{n}`, where `n` changes only for a genuine new payment attempt by the user. The key must never be regenerated on process restart for the same logical payment.

**Use the processor's mechanism.** Stripe takes an `Idempotency-Key` header. PayPal, Adyen, and Square have equivalents. Read the retention window — Stripe's is 24 hours. A retry after the window expires is a fresh charge. That matters for a job that retries with long backoff.

**Do the same in your own service.** Your API needs the same protection as the processor's. Without it, a client retry against you creates two charge attempts with two different keys. Accept an idempotency key on your payment endpoint, store it under a unique constraint, and return the original response on a repeat. The unique constraint is what makes this safe under concurrency. Two simultaneous retries will race, and one must lose at the database instead of both proceeding.

**Handle the concurrent-in-flight case.** A second request may arrive while the first is still running. Do not start a second charge. Return 409, or block on the first. Store the key before performing the charge, not after.

## Two checks to run next

Reconcile against the processor. Idempotency keys reduce duplicates. A daily reconciliation job comparing your charge records to the processor's catches the ones that slip through. You need that job for a second reason: your database write can fail after a successful charge.

Retry only what is retryable. A 400 or a card decline will never succeed on retry. Retrying it wastes budget and can trip fraud rules. Retry timeouts, connection failures, 429s, and 5xx. Use exponential backoff with jitter, so a processor blip does not turn into a stampede.
