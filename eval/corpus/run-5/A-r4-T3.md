---
kind: eval-artifact
run: 5
variant: A
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry could not tell "the charge failed" from "the charge succeeded and the reply got lost." It assumed the first, and the second was true.

## What happened

A payment request has two independent things that can go wrong: the work, and the answer about the work.

Your client sent a charge. The payment processor took the money. Then the response died on the way back — a timeout, a dropped connection, a load balancer that gave up at 30 seconds, a pod that got killed after doing the work but before replying.

Your client saw no response. It concluded failure. It retried. The processor received what looked like a fresh, valid charge request and charged again.

Nothing malfunctioned. Every component did exactly what it was told. The bug is that a timeout is not information about the outcome — it is the absence of information, and your code read it as a "no."

## Why this is unavoidable without help

You cannot fix this by retrying more carefully, or by picking better timeouts. There is no message you can send and no timeout you can choose that tells you the difference between "never arrived" and "arrived, worked, reply lost." That ambiguity is a property of networks, not a flaw in your client.

Retries themselves are still right. Networks really do drop requests, and giving up on the first blip means losing real payments. You need retries. You just need the server to be able to recognize a repeat.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. `DELETE /users/42` is naturally idempotent — the second call finds nothing to delete and the world ends up the same. `POST /charges` is naturally the opposite: two calls, two charges.

You make a non-idempotent operation safe by giving each *intent* a name, and having the server remember names it has seen.

## How it works in practice

The client generates a unique key per logical operation — a UUID — and sends it with the request:

```
POST /v1/charges
Idempotency-Key: 8f14e45f-ea0e-4d1c-9d5b-2a7c6b3e1f90

{ "amount": 4999, "currency": "usd", "source": "..." }
```

The server, on receiving it:

1. Tries to claim the key by inserting it into a table with a uniqueness constraint, in the same transaction that performs the charge.
2. If the insert succeeds, it is a first attempt. Do the charge, store the response body against the key, commit, return it.
3. If the insert collides, this key has been seen. Return the stored response. Do not charge.
4. If the key is claimed but not yet finished, return 409 and let the client retry shortly.

Your retry now arrives with the same key, hits step 3, and gets back the original success — the same charge id, the same amount. One charge, and the client learns the true outcome.

## The details that decide whether it actually works

**Generate the key at the point of intent, not at the point of send.** This is the mistake that quietly defeats the whole scheme. If you create the UUID inside the retry loop, each attempt gets a fresh key and the server sees three unrelated charges. The key belongs to "the user pressed Pay once," so create it before the first attempt and reuse it for every retry of that intent.

**Store the key in the same transaction as the effect.** If the key write and the charge are separate commits, the process can die between them and you are back to double-charging. One transaction, or the guarantee is fiction.

**Hash the request body against the key.** If a client reuses a key with different parameters, that is a client bug — reject it with a 422 rather than returning a response for a different amount.

**Set an expiry, and make it longer than your retry window.** Twenty-four hours is a common choice. Keys are not permanent history; they are a deduplication window.

**Only retry what is safe to retry.** A 400 or 422 will fail identically forever — retrying wastes time and hides the error. Retry on timeouts, connection failures, 429, and 5xx. Use exponential backoff with jitter, so a processor blip does not turn into a synchronized stampede when everyone retries at the same instant.

## The rule to carry forward

Any request that changes money, sends a message, or creates a resource needs an idempotency key if the client is allowed to retry it — and the client is always allowed to retry it, because sometimes the network retries for you.

Stripe, Adyen, and Square all expose this header. If you are calling one of them and not sending it, you are exposed today.
