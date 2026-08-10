---
kind: eval-artifact
run: 6
variant: P
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your retry sent a second charge for a payment that had already gone through. The first request worked; its response never reached you. Your code could not tell "it failed" from "it worked and I did not hear back," so it retried, and the processor did what you asked twice.

## The failure in detail

A charge has two halves: the request going out and the response coming back. A timeout says only that the round trip did not finish. It does not say which half broke.

```
you ──── charge $50 ────▶ processor    money moves
you ◀─── 200 OK ──X────  processor     response lost
you: timeout → retry
you ──── charge $50 ────▶ processor    money moves again
```

Both cases look identical from your side. A dropped response, a load balancer killing a slow connection, your client timing out while the processor was still committing — each produces the same silence, and in each the charge may already exist.

Retrying more carefully will not fix this, and neither will a longer timeout. Every retry over a network has this property. The only question is whether the receiver absorbs the duplicate.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. Reading a row is idempotent. Setting a balance to $50 is idempotent. Charging $50 is not, because each call adds a new fact to the world.

So make the *request* idempotent even though the *operation* is not. Attach a unique key to the charge, generated once, before the first attempt. Every retry of that logical charge carries the same key. The processor stores the key alongside the result. Seeing a key it already recorded, it skips the charge and replays the original response.

```
POST /charges
Idempotency-Key: 7a1f8c3e-...
{ "amount": 5000, "currency": "usd" }
```

The retry is now safe. The second request returns the first charge id, and the customer pays once.

## Getting it right

**Generate the key before the first attempt, not inside the retry.** This mistake quietly defeats the whole mechanism. A fresh key per attempt makes every retry look like a new charge, which puts you back where you started.

**Tie the key to the business intent, not the attempt.** One key per checkout, per invoice, per payout. A customer who genuinely buys the same item twice has two intents and gets two keys.

**Persist the key before you send.** If your process crashes mid-charge, it has to come back and reuse that key rather than invent one. Write a row first — key, amount, status `pending` — and you have it.

**Every major processor supports this.** Stripe, Adyen, Braintree, and PayPal all take an idempotency key, typically remembering it for 24 hours. Read your processor's exact semantics, especially what it does when a key returns with a *different* payload — most call that an error, which is a useful safety net.

**Retry only what is safe to retry.** Even with keys, retry timeouts, connection errors, and 5xx responses only. Do not retry a 4xx; the request was rejected on its merits and will be rejected again. Use exponential backoff with jitter so a brief processor problem does not become a stampede.

## The general lesson

Any retry that crosses a network and causes a side effect needs this: sending email, provisioning a resource, publishing a message, calling a partner API. Networks give you at-least-once delivery cheaply. Exactly-once is what you want, and you build it by teaching the receiver to recognize and drop duplicates. The idempotency key is how it recognizes them.
