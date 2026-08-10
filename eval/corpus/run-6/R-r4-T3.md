---
kind: eval-artifact
run: 6
variant: R
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your retry could not tell "the charge failed" from "the charge succeeded and the reply got lost." It picked the first. The second was true.

## What happened

A payment request has two independent parts that can go wrong: the work, and the answer about the work.

Your client sent a charge. The payment processor took the money. Then the response died on the way back. Pick your cause — a timeout, a dropped connection, a load balancer that gave up at 30 seconds, a pod that got killed after doing the work but before replying.

Your client saw no response. It concluded failure. It retried. The processor read a fresh, valid charge request and charged again.

Nothing malfunctioned. Every component did what you told it to do. The bug is what a timeout means. A timeout carries no information about the outcome. It is the absence of information, and your code read it as a "no."

## Why this is unavoidable without help

You cannot fix this by retrying more carefully, or by tuning timeouts. No message you can send and no timeout you can choose separates "never arrived" from "arrived, worked, reply lost." That ambiguity is a property of networks, not a flaw in your client.

Retries themselves are still right. Networks drop requests, and giving up on the first blip loses real payments. You need retries. You also need the server to recognize a repeat.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. `DELETE /users/42` is naturally idempotent. The second call has nothing left to delete and the world ends up the same. `POST /charges` is the opposite: two calls, two charges.

You make a non-idempotent operation safe by giving each *intent* a name, and having the server remember the names it has seen.

## How it works in practice

The client generates a unique key per logical operation — a UUID — and sends it with the request:

```
POST /v1/charges
Idempotency-Key: 8f14e45f-ea0e-4d1c-9d5b-2a7c6b3e1f90

{ "amount": 4999, "currency": "usd", "source": "..." }
```

The server, on receiving it:

1. Tries to claim the key by inserting it into a table with a uniqueness constraint, in the same transaction that performs the charge.
2. If the insert succeeds, this is a first attempt. Do the charge, store the response body against the key, commit, return it.
3. If the insert collides, the server has seen this key. Return the stored response. Do not charge.
4. If the key is claimed but not yet finished, return 409 and let the client retry shortly.

Your retry now arrives with the same key and hits step 3. It gets back the original success — the same charge id, the same amount. One charge, and the client learns the true outcome.

## The details that decide whether it works

**Generate the key at the point of intent, not at the point of send.** This mistake quietly defeats the whole scheme. Create the UUID inside the retry loop and each attempt gets a fresh key, so the server sees three unrelated charges. The key belongs to "the user pressed Pay once." Create it before the first attempt and reuse it for every retry of that intent.

**Store the key in the same transaction as the effect.** If the key write and the charge are separate commits, the process can die between them. Then you are back to double-charging. One transaction, or the guarantee is fiction.

**Hash the request body against the key.** If a client reuses a key with different values, that is a client bug. Reject it with a 422 instead of returning a response for a different amount.

**Set an expiry, and make it longer than your retry window.** Twenty-four hours is a common choice. Keys are not permanent history. They are a deduplication window.

**Only retry what is safe to retry.** A 400 or 422 will fail identically forever. Retrying it wastes time and hides the error. Retry on timeouts, connection failures, 429, and 5xx. Use exponential backoff with jitter, so a processor blip does not turn into a synchronized stampede.

## The rule to carry forward

Any request that moves money, sends a message, or creates a resource needs an idempotency key when the client may retry it. The client may retry it, because the network retries for you whether you planned it or not.

Stripe, Adyen, and Square all expose this header. If you call one of them without sending it, you are exposed today.
