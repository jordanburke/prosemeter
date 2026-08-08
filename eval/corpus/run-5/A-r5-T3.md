---
kind: eval-artifact
run: 5
variant: A
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge request for a payment that had already succeeded. The first request worked; the response back to you did not arrive. Your code could not tell the difference between "it failed" and "it worked and I did not hear about it," so it retried, and the payment processor did exactly what you asked twice.

## The failure in detail

A charge request has two halves: your request going out, and the response coming back. A timeout tells you only that the round trip did not finish. It does not tell you which half failed.

```
you ──── charge $50 ────▶ processor    money moves
you ◀─── 200 OK ──X────  processor     response lost
you: timeout → retry
you ──── charge $50 ────▶ processor    money moves again
```

From your side both cases look identical. The network dropped the response, the load balancer killed a slow connection, your client hit its timeout while the processor was still committing — every one of these produces the same silence, and in every one the charge may already exist.

This is not a bug you can fix by retrying more carefully or by setting a longer timeout. Any retry over a network has this property. The only question is whether the receiving side is built to absorb the duplicate.

## What idempotency means here

An operation is idempotent if doing it twice has the same effect as doing it once. Reading a row is naturally idempotent. Setting a balance to $50 is idempotent. Charging $50 is not — each call is a new fact in the world.

The fix is to make the *request* idempotent even though the *operation* is not. You attach a unique key to the charge, generated once, before the first attempt. Every retry of that same logical charge carries the same key. The processor stores the key with the result. On seeing a key it has already recorded, it does not charge again; it replays the original response.

```
POST /charges
Idempotency-Key: 7a1f8c3e-...
{ "amount": 5000, "currency": "usd" }
```

Now the retry is safe. The second request returns the same charge id as the first, and the customer is billed once.

## Getting it right

**Generate the key before the first attempt, not inside the retry.** This is the mistake that quietly defeats the whole mechanism. If a new key is minted per attempt, every retry looks like a brand new charge and you are back where you started.

**Tie the key to the business intent, not the attempt.** One key per checkout, per invoice, per payout. If the user legitimately buys the same item twice, that is two intents and two keys.

**Persist the key before you send the request.** If your own process crashes mid-charge, it has to come back and reuse the same key rather than inventing a fresh one. A row written to your database first — key, amount, status `pending` — gives you that.

**Every major processor supports this.** Stripe, Adyen, Braintree, and PayPal all accept an idempotency key header or field, typically remembering it for 24 hours. Read your processor's exact semantics, especially what happens when you reuse a key with a *different* payload — most treat that as an error, which is a useful safety net.

**Retry only what is safe.** Even with keys, retry on timeouts, connection errors, and 5xx responses. Do not retry a 4xx; the request was rejected on its merits and will be rejected again. Add exponential backoff with jitter so a processor blip does not turn into a stampede.

## The general lesson

Anywhere a retry crosses a network and causes a side effect, you need this: sending email, provisioning a resource, publishing a message, calling a partner API. "At least once delivery" is what networks give you cheaply. "Exactly once" is what you actually want, and you build it by making the receiver recognize and discard duplicates. The idempotency key is how the receiver recognizes them.
