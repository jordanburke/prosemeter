---
kind: eval-artifact
run: 5
variant: A
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry logic charged the card twice because a failed request is not the same thing as a failed charge. The first attempt probably succeeded at the payment processor and failed on the way back to you.

## What went wrong

A charge request crosses a network. There are three places it can break, and from the client they look identical:

1. The request never arrived. No charge happened. Retrying is correct.
2. The request arrived, the processor charged the card, and the response was lost — a timeout, a dropped connection, a load balancer killing an idle socket. The charge happened. Retrying charges again.
3. The request arrived, the charge succeeded, and your own code crashed before recording it. Same outcome as case 2.

Your client sees a timeout in all three cases. It cannot tell them apart, so it retries, and in cases 2 and 3 that produces a second real charge.

This is not a bug you can fix by retrying more carefully. It is a property of distributed systems: you cannot distinguish "not done" from "done but I did not hear about it" using the network alone. Timeouts make it worse, because the request that timed out is often the one that is still in flight and about to succeed.

## What idempotency means here

An operation is idempotent if doing it twice has the same effect as doing it once. Reading a row is naturally idempotent. Charging a card is naturally not — two charges take twice the money.

Idempotency keys make a non-idempotent operation behave like an idempotent one. You generate a unique key for each *logical* charge — not for each HTTP attempt — and send it with the request. The processor records the key alongside the result. If a request arrives with a key it has already seen, it does not perform the charge again; it returns the stored result of the original.

Now the retry is safe. Case 1 has no stored key, so the retry charges once. Cases 2 and 3 do, so the retry returns the original charge instead of making a new one. In all three cases exactly one charge exists.

## How to implement it

**Generate the key at the top of the operation, before the first attempt.** This is the part people get wrong. If you generate the key inside the retry loop, every attempt gets a fresh key and you are back where you started. The key identifies the customer's intent to pay, so it should be created when that intent is formed — when the user clicks Pay, or when the order row is created — and reused for every attempt including retries that happen minutes later after a process restart.

**Make the key deterministic or store it.** A UUID persisted alongside the order works. So does a derived key such as `order-{id}-attempt-{n}` where `n` only changes for a genuine new payment attempt by the user. What must not happen is the key being regenerated on process restart for the same logical payment.

**Use the processor's mechanism.** Stripe takes an `Idempotency-Key` header. PayPal, Adyen, and Square have equivalents. Read the retention window — Stripe's is 24 hours — because a retry after the window expires is a fresh charge again. That matters for a job that retries with long backoff.

**Do the same thing in your own service.** Your API needs the same protection as the processor's, or a client retry against you creates two charge attempts with two different keys. Accept an idempotency key on your payment endpoint, store it with a unique constraint, and return the original response on a repeat. The unique constraint is what makes it safe under concurrency; two simultaneous retries will race, and one must lose at the database rather than both proceeding.

**Handle the concurrent-in-flight case.** If a second request arrives while the first is still running, do not start a second charge. Return 409, or block on the first. Storing the key before performing the charge — not after — is what makes this possible.

## Two things to check next

Reconcile against the processor. Idempotency keys reduce duplicates; a daily reconciliation job comparing your charge records to the processor's is what catches the ones that slip through, and it is what you need anyway for the cases where your database write failed after a successful charge.

Only retry what is retryable. A 400 or a card decline will never succeed on retry, and retrying it wastes budget and can trip fraud rules. Retry timeouts, connection failures, 429s, and 5xx. Use exponential backoff with jitter so a processor blip does not turn into a stampede.
