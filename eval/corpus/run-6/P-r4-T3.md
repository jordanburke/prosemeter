---
kind: eval-artifact
run: 6
variant: P
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your retry could not tell "the charge failed" from "the charge succeeded and the reply got lost." It assumed the first. The second was true.

## What happened

A payment request has two things that can fail independently: the work, and the answer about the work.

Your client sent a charge. The processor took the money. Then the response died on the way back — a timeout, a dropped connection, a load balancer that gave up at 30 seconds, a pod killed after doing the work and before replying.

Your client saw no response, concluded failure, and retried. The processor received what looked like a fresh, valid charge and charged again.

Nothing malfunctioned. Every component did what it was told. The bug is that a timeout carries no information about the outcome. It is the absence of information, and your code read it as a no.

## Why you cannot fix this with better retries

No message you can send and no timeout you can pick tells you the difference between "never arrived" and "arrived, worked, reply lost." That ambiguity belongs to networks, not to your client.

Retries are still right. Networks really do drop requests, and giving up on the first blip loses real payments. Keep the retries. Give the server a way to recognize a repeat.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. `DELETE /users/42` is naturally idempotent: the second call finds nothing to delete and the world ends up the same. `POST /charges` is the opposite — two calls, two charges.

You make a non-idempotent operation safe by giving each *intent* a name, and having the server remember the names it has seen.

## How it works in practice

The client generates one key per logical operation, a UUID, and sends it with the request:

```
POST /v1/charges
Idempotency-Key: 8f14e45f-ea0e-4d1c-9d5b-2a7c6b3e1f90

{ "amount": 4999, "currency": "usd", "source": "..." }
```

The server, on receiving it:

1. Tries to claim the key by inserting it into a table with a uniqueness constraint, in the same transaction that performs the charge.
2. If the insert succeeds, this is a first attempt. Charge, store the response body against the key, commit, return it.
3. If the insert collides, the key has been seen. Return the stored response. Do not charge.
4. If the key is claimed but not finished, return 409 and let the client retry shortly.

Your retry now arrives with the same key, hits step 3, and gets back the original success — same charge id, same amount. One charge, and the client learns the true outcome.

## The details that decide whether it works

**Generate the key at the point of intent, not the point of send.** This is the mistake that quietly defeats the whole scheme. Create the UUID inside the retry loop and every attempt gets a fresh key, so the server sees three unrelated charges. The key belongs to "the user pressed Pay once." Create it before the first attempt and reuse it for every retry of that intent.

**Store the key in the same transaction as the effect.** If the key write and the charge are separate commits, the process can die between them and you are double-charging again. One transaction, or the guarantee is fiction.

**Hash the request body against the key.** If a client reuses a key with different parameters, that is a client bug. Reject it with a 422 rather than returning a response for a different amount.

**Set an expiry longer than your retry window.** Twenty-four hours is a common choice. Keys are a deduplication window, not permanent history.

**Retry only what is safe to retry.** A 400 or 422 will fail the same way forever, so retrying wastes time and hides the error. Retry on timeouts, connection failures, 429, and 5xx. Use exponential backoff with jitter, so a processor blip does not become a stampede of clients all retrying at the same instant.

## The rule to carry forward

Any request that moves money, sends a message, or creates a resource needs an idempotency key if the client may retry it — and the client may always retry it, because sometimes the network retries for you.

Stripe, Adyen, and Square all expose this header. If you call one of them without it, you are exposed today.
