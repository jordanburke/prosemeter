---
kind: eval-artifact
run: 1
variant: E
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus,sonnet"
  error: "Self-contradictory 429/4xx retry advice, plus the Square header error in its most explicit form."
---
Your retry sent a second charge request, and the payment provider treated it as a second, unrelated charge. The first request almost certainly succeeded. What failed was the *response* — a timeout, a dropped connection, a 502 from something between you and the provider. Your client saw no answer and could not tell "the charge never happened" apart from "the charge happened and I missed the receipt." It guessed the first one and retried.

That is the whole bug. A timeout is not a failure signal. It is an absence of information.

**Idempotency is how you close the gap.** An idempotent operation gives the same result whether you run it once or five times. Charging a card is not idempotent by nature — each call moves money. So you make it idempotent by attaching a key.

You generate a unique key **before** the first attempt and send the same key on every retry:

```
POST /v1/charges
Idempotency-Key: 7f3a91c2-order-88213
```

The provider stores the key with the result of the first request. When your retry arrives with the same key, the provider skips the work and replays the stored response. You get your receipt, and the customer gets charged once.

**Three rules that matter:**

1. **Generate the key once, outside the retry loop.** A key created inside the loop changes on every attempt, which is the same as having no key at all. This is the most common way people get this wrong.
2. **Tie the key to the business event, not the attempt.** Derive it from the order or invoice — `charge:order-88213`. Then a retry from a different process, a different pod, or a job that resumed after a crash still collapses onto the same charge.
3. **Persist the key before you call out.** Write it to your database first, then make the request. If your service dies mid-call, the restarted process reads the key back and reuses it instead of minting a fresh one.

Also fix the retry policy itself. Retry on timeouts, connection errors, 429, and 5xx. Never retry a 4xx — the provider understood you and said no, so trying again just repeats the rejection. Use exponential backoff with jitter so a provider blip does not turn into your whole fleet stampeding at the same instant.

Stripe, Adyen, and Square all support idempotency keys, and they all key by header. Check what your provider's retention window is — Stripe's is 24 hours, so a retry a week later is a genuinely new charge.

For the duplicates already out there, pull charges grouped by customer and amount within a short time window, then refund the extras before support hears about it.
