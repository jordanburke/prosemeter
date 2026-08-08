---
kind: eval-artifact
run: 5
variant: L
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first request succeeded and you never learned that. A timeout tells you nothing about what the server did. Idempotency keys fix it: you send a unique key with the charge, and the payment provider returns the original result instead of charging again.

## What went wrong

You sent a charge. The network dropped, or the response took too long, so your client raised a timeout and retried.

But a timeout is not a failure. It is silence. Three things produce identical silence:

- The request never reached the provider. Retrying is correct.
- The provider charged the card, and the response was lost coming back. Retrying charges again.
- The provider is still working on it. Retrying races your own first request.

Your retry logic treated all three as the first case. In the second case, that means a duplicate charge. The customer sees two lines on their statement and the money is really gone twice.

This is not a bug in your retry code. No amount of client-side cleverness distinguishes those three states, because the information you need never arrived.

## What idempotency means

An operation is idempotent when doing it twice has the same effect as doing it once. Deleting a file is idempotent — the file ends up gone either way. Charging a card is not, because the second call moves more money.

You cannot make charging naturally idempotent. So you make it idempotent by agreement: you attach an identifier that lets the server recognize a repeat.

## How the key works

Generate a unique key per charge attempt — a UUID is fine — and send it as a header:

```
POST /v1/charges
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

The provider stores the key with the result. On the retry it sees the key already, skips the charge, and replays the stored response. You get the same charge id and the same status, and the customer is billed once.

Stripe, Square, Adyen, and PayPal all support this. Check your provider's docs for the exact header and how long they retain keys — usually 24 hours.

## The rules that make it actually work

**Generate the key before the first attempt, and reuse it across every retry.** A fresh key per attempt is the bug you already have, wearing a hat.

**Derive the key from the intent, not the attempt.** Key it to the order, the invoice, the cart checkout. If the user clicks Pay twice, or your process crashes and restarts, the same intent should produce the same key.

**Persist the key before you send.** Write it to your database in the same transaction that records the payment attempt. If you crash mid-flight, recovery reads the key and retries with it.

**Do not change the body under a reused key.** Providers reject a key reused with different parameters, and they should. That guard catches real bugs.

## Two things to add alongside

Reconcile. Before retrying, or on a schedule, ask the provider what actually exists. Every payment API lets you look up charges by your own reference. That closes the window the key does not cover.

Back off. Retry after 1s, 2s, 4s, with jitter, and cap the attempts. Immediate retries pile load on a service that is already struggling.

## The general lesson

Any operation that changes state across a network needs a repeat story. Ask of every write endpoint: what happens if this arrives twice? If the answer is "the caller is charged twice", "the email sends twice", or "two records appear", you need a key. Design it in at the endpoint, not in the retry loop.
