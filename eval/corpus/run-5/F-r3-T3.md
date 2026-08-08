---
kind: eval-artifact
run: 5
variant: F
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did retrying cause duplicate charges?

Your retry fired after a charge that had already succeeded. A failed response does not mean a failed charge.

Three things happen in a charge request, and they happen in this order: your call reaches the payment provider, the provider moves the money, the provider's response reaches you. A timeout or a network error tells you the third step failed. It tells you nothing about the second.

So a timeout has two possible histories behind it:

- The request never arrived, or arrived and failed. No money moved. Retrying is correct.
- The request arrived, the money moved, and the response was lost or arrived too late. Retrying charges the customer twice.

Your code cannot tell these apart, because they look identical from where it sits. It retried, and often enough it was the second history.

Slow responses make this worse than plain network loss. A provider under load may take longer than your client's timeout. Your client gives up at 10 seconds; the provider finishes at 12. From the provider's side nothing failed at all.

## What does idempotency have to do with it?

Idempotency means doing something twice has the same effect as doing it once. It is the property that makes a retry safe.

Reading a balance is naturally idempotent — ask twice, get the same answer, change nothing. Charging a card is not. Each call moves money, so two calls move twice as much.

You cannot make a charge idempotent by wishing. You make it idempotent by giving each charge a name and asking the provider to remember it.

That name is an **idempotency key** — a unique string you generate for one logical operation and send with the request. The provider stores it with the result. On the first request with a given key it does the work and saves the outcome under that key. On any later request with the same key it skips the work and replays the saved outcome.

Now the retry is safe. If the first attempt got through, the retry returns the same charge and the same charge id, and no second charge exists. If it never got through, the retry does the work for the first time.

```
POST /v1/charges
Idempotency-Key: order-8f2c1a-attempt
{ "amount": 4200, "currency": "usd", "source": "tok_..." }
```

Stripe, Adyen, Square, and PayPal all support this. Check your provider's docs for the exact header name and how long it keeps keys — 24 hours is a common window.

## How do I generate the key correctly?

Get this wrong and the key gives you no protection.

**Generate one key per logical charge, not per attempt.** All retries of the same charge must send the same key. A fresh UUID per attempt makes every retry look like a new charge, which is the bug you started with.

**Derive it from your own data, not from the clock or a random source at call time.** A good key is tied to the thing being paid for — the order id, or a payment-attempt row you wrote to your database before calling out. Store it, then send it. If your process crashes and restarts, it reads the stored key and reuses it.

**Give a genuinely new charge a genuinely new key.** If a customer really does want to pay twice, that is a second order and a second key. Keying on customer id alone would silently swallow the second payment.

## What else should I change?

Three fixes go alongside the key.

**Write your intent down before you call out.** Insert a row that says "attempting payment for order X with key K" and commit it. Then call. If anything crashes, the row tells you a charge may exist, and the key lets you find out safely.

**Reconcile instead of guessing.** After exhausting retries, query the provider for the charge by your key or by your order reference before deciding it did not happen. Most providers let you search by metadata you set.

**Retry only what is worth retrying, and back off.** A timeout or a 5xx is worth retrying. A declined card is not — the answer will not change, and hammering it can trip fraud limits. Space the attempts out with exponential backoff and add a little randomness, so a provider recovering from an outage does not get every client's retries in the same instant.

Idempotency keys are not payments-only. Any operation with a side effect deserves one: sending an email, provisioning a server, posting to a ledger. Anywhere a retry could double an effect, name the operation and make the second call a no-op.
