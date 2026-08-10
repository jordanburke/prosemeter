---
kind: eval-artifact
run: 6
variant: R
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your retry sent a second charge for a payment that had already succeeded. The first request worked. The response never came back to you. Your code cannot tell "it failed" apart from "it worked and I did not hear about it." So it retried, and the processor did what you asked, twice.

## The failure in detail

A charge request has two halves: your request going out, and the response coming back. A timeout tells you the round trip did not finish. It does not tell you which half failed.

```
you ──── charge $50 ────▶ processor    money moves
you ◀─── 200 OK ──X────  processor     response lost
you: timeout → retry
you ──── charge $50 ────▶ processor    money moves again
```

From your side both cases are identical. The network dropped the response. The load balancer killed a slow connection. Your client hit its timeout while the processor was still committing. Each of these produces the same silence, and in each one the charge already exists.

Retrying more carefully will not fix this. A longer timeout will not fix it either. Any retry over a network has this property. The one question is whether the receiving side absorbs the duplicate.

## What idempotency means here

An operation is idempotent when doing it twice has the same effect as doing it once. Reading a row is idempotent. Setting a balance to $50 is idempotent. Charging $50 is not, because each call adds a new fact to the world.

The fix makes the *request* idempotent even though the *operation* is not. You attach a unique key to the charge, generated once, before the first attempt. Every retry of that logical charge carries the same key. The processor stores the key with the result. When it sees a key it already recorded, it does not charge again. It replays the original response.

```
POST /charges
Idempotency-Key: 7a1f8c3e-...
{ "amount": 5000, "currency": "usd" }
```

Now the retry is safe. The second request returns the same charge id as the first, and the customer pays once.

## Getting it right

**Generate the key before the first attempt, not inside the retry.** This mistake quietly defeats the whole mechanism. Mint a new key per attempt and every retry is a brand new charge. You are back where you started.

**Tie the key to the business intent, not the attempt.** One key per checkout, per invoice, per payout. If the user buys the same item twice on purpose, that is two intents and two keys.

**Persist the key before you send the request.** Your own process can crash mid-charge. When it comes back it has to reuse the same key instead of inventing a fresh one. Write a row to your database first — key, amount, status `pending` — and you have that.

**Every major processor supports this.** Stripe, Adyen, Braintree, and PayPal accept an idempotency key header or field, and remember it for 24 hours. Read your processor's exact semantics. Check what happens when you reuse a key with a *different* payload — several treat that as an error, which catches a bug for you.

**Retry only what is safe.** Even with keys, retry on timeouts, connection errors, and 5xx responses. Do not retry a 4xx. The processor rejected the request on its merits and will reject it again. Add exponential backoff with jitter so a processor blip does not become a stampede.

## The general lesson

You need this anywhere a retry crosses a network and causes a side effect: sending email, provisioning a resource, publishing a message, calling a partner API. Networks give you "at-least-once delivery" cheaply. "Exactly once" is what you want, and you build it by making the receiver spot duplicates and discard them. The idempotency key is how the receiver spots them.
