---
kind: eval-artifact
run: 5
variant: E
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry logic double-charged because a timeout does not tell you the charge failed. It tells you that you stopped waiting. The first charge probably succeeded; your retry created a second, separate one. Idempotency is the fix — it lets the payment provider recognize the retry as the same charge and return the original result instead of making a new one.

## What actually happened

Trace the failing case:

1. Your service sends `POST /charges` for $50.
2. The provider receives it, charges the card, writes the record.
3. The response is lost — a network blip, a load balancer timeout, a pod restart, a 504 from a proxy.
4. Your client raises a timeout.
5. Your retry sends `POST /charges` for $50 again.
6. The provider sees a brand-new request and charges again.

Nothing malfunctioned. Step 3 is the whole problem. A failed response is indistinguishable from a failed request from where you are standing, and you guessed wrong about which one it was.

This is why "retry on error" is safe for reads and dangerous for writes. `GET` has no side effect, so a duplicate costs nothing. `POST /charges` moves money every time it runs.

## What idempotency means here

An operation is idempotent when running it twice has the same effect as running it once. Payment APIs give you this through an **idempotency key** — a unique string you generate and send with the request.

```
POST /charges
Idempotency-Key: 9f2c1a4e-...
{ "amount": 5000, "currency": "usd", "source": "tok_..." }
```

The provider stores the key with the result. On a repeat with the same key, it skips the charge and replays the stored response. Your retry now returns the original charge, with the original ID, and the customer pays once.

Stripe, Adyen, Square, and PayPal all support this. The header name varies; the mechanic does not.

## Getting the key right

The key must be **stable across retries and unique across intents**. That single sentence contains both mistakes people make.

- **Generate it before the first attempt, and reuse it for every retry of that attempt.** Generating a fresh key inside the retry loop gives you exactly the bug you have now.
- **Do not reuse it across genuinely different payments.** If a customer legitimately buys the same item twice, that is two intents and needs two keys.
- **Derive it from something durable.** Your order ID or payment-attempt ID works well. A random UUID works too, but only if you persist it before you call the provider — otherwise a crash loses the key and the retry starts fresh.

Note the expiry. Most providers keep keys for around 24 hours. A retry after that window is a new charge.

## The rest of the job

The provider's key protects the provider's side. Your side needs the same discipline.

**Persist the attempt first.** Write a row with the key and a `pending` state before you call out. If your process dies mid-call, recovery reads that row, finds the key, and retries with it rather than starting over.

**Make the whole path safe, not just the charge.** Webhooks redeliver. If your `charge.succeeded` handler grants credit, a redelivery grants it twice. Dedupe on the event ID, and make the grant conditional on current state.

**Fix the retry policy too.** Retry only on timeouts, 5xx, and 429. A 402 declined card is a final answer — retrying it just annoys the issuer and risks a fraud flag. Use exponential backoff with jitter, and cap the attempts.

**Reconcile.** Pull the provider's charge list daily and compare it to your ledger. Duplicates that slip through show up here, and you want to find them before your customer does.

## The short version

Retries are only safe when the operation is idempotent. Payments are not idempotent by default, so you make them idempotent with a key you generate once, store, and resend unchanged. Without that key, every retry is a fresh charge — and the network will eventually make you retry.
