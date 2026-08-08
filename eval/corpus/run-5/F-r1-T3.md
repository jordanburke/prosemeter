---
kind: eval-artifact
run: 5
variant: F
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge because the first one succeeded and the response got lost. The payment provider saw two separate requests and did what it was told twice. Idempotency is the fix: it lets you tell the provider "this is the same charge I already sent," so the retry returns the first result instead of making a new one.

## Why did the retry charge twice?

A failed request has two very different causes, and your client cannot tell them apart.

The request may never have arrived. The provider did nothing, and retrying is correct.

Or the request arrived, the charge went through, and the *response* was lost — a timeout, a dropped connection, a load balancer that gave up at 30 seconds while the provider took 31. The money moved. Your code saw an error and retried. The provider received what looks like a brand new charge for the same amount and charged again.

That second case is the one that bit you. A timeout is not a failure. A timeout is an unknown outcome.

Retries make it worse in a specific way. The requests most likely to time out are the slow ones, and slow requests are the ones most likely to have done real work before the connection died. Your retry logic fires exactly when duplication is most likely.

## What is idempotency?

An operation is **idempotent** when doing it twice has the same effect as doing it once.

Deleting a row is idempotent — delete it again and it is still deleted. Setting a balance to $50 is idempotent. Adding $50 to a balance is not, and neither is creating a charge. Each call creates a new thing.

Payment APIs cannot make charge creation naturally idempotent, because two identical $50 charges to the same card are sometimes exactly what the customer wanted. So they let you say which one you meant.

## How do I fix it?

Send an **idempotency key** with every charge — a unique string that identifies the *intent*, not the request. Stripe, Adyen, Square, and most others support this as a header or a field.

The provider stores the key with the result. A second request carrying the same key returns the stored result and creates nothing. Your retry becomes safe.

Four rules make it actually work:

**Generate the key before the first attempt, and reuse it for every retry.** A key generated inside the retry loop is a new key each time, which is the bug you already have. Generate it once, at the top, and pass it down.

**Derive the key from the intent, not from the clock or a random source alone.** A UUID stored alongside the pending order works. Hashing the request body does not — two genuine identical charges collide. The common shape is one key per order, per payment attempt.

**Persist the key before you call out.** Write the key and a `pending` status to your own database, commit, then call the provider. If your process dies mid-call, the key is on disk and the next attempt reuses it. A key held only in memory disappears exactly when you need it.

**Handle the "unknown" state on your side too.** When a call times out, do not mark the order failed. Mark it unknown, then retry with the same key or query the provider for that key. Both give you a definite answer.

## What about the rest of the system?

The same hole exists anywhere a retry can reach a side effect: sending email, shipping an order, publishing an event, calling an internal service.

Make the write itself reject duplicates where you can. A unique constraint on `(order_id, attempt)` in your payments table turns a duplicate insert into a database error instead of a duplicate charge. That is a second line of defense that does not depend on the provider behaving.

Also check that you are only retrying what is safe. A 500 or a timeout is worth retrying with a key. A 400 means the request was wrong and will be wrong again — retrying it just adds load.

The idea to keep: an idempotency key turns "I do not know if that worked" into "ask again and find out," which is the only safe way to retry anything that moves money.
