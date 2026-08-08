---
kind: eval-artifact
run: 1
variant: F
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "Overbroad 4xx advice, plus a claim that retrying with the same idempotency key 'burns' it."
---
Your retry sent a second charge because the first one probably succeeded. The response failed, not the charge.

**What happened**

Your client called the payment API. The charge went through on their side. Then the response got lost — a timeout, a dropped connection, a 502 from a proxy, a gateway restart.

Your client saw no success, so it retried. The payment provider saw a brand-new, valid charge request and charged the card again.

The key point: **a failed response does not mean a failed operation.** You cannot tell "never happened" apart from "happened, but I didn't hear back." Retrying on that ambiguity is what duplicates the charge.

**Where idempotency comes in**

An idempotent operation gives the same result whether you run it once or ten times. `DELETE /user/42` is naturally idempotent. `POST /charge` is not — each call means "charge again."

You make it idempotent by attaching a key that identifies the *attempt*:

```
POST /charges
Idempotency-Key: 7f3a9c2e-payment-for-order-1234
```

The provider stores that key with the result. On a repeat with the same key, it skips the charge and replays the stored response. Your retry then returns the original charge instead of creating a new one. Stripe, Adyen, and Square all work this way.

**How to do it right**

**Generate the key before the first attempt, and reuse it across every retry.** This is where teams go wrong. A key minted inside the retry loop is new each time, so it protects nothing.

**Derive it from the business action, not the request.** Key on the order ID or invoice ID — the thing that should be charged exactly once. Then a retry after a full process crash still lands on the same key.

**Persist it before you call.** Write `(order_id, idempotency_key, status=pending)` to your database, then make the call. If you crash mid-flight, recovery reads the key and resumes safely.

**Handle the in-flight case.** Two concurrent requests with the same key should not both charge. Providers return a 409 or a "request in progress" error — treat it as "someone else has this," not as failure to retry.

**Retry only what's safe.** Retry timeouts, 5xx, and network errors. Never retry a 4xx — the request was rejected on its merits, and retrying just burns your key.

**On your own endpoints**

If you expose payment endpoints, accept an `Idempotency-Key` header yourself. Store it with a unique constraint against the response, and set a TTL of 24 hours or so. Your callers face the same ambiguity you just did.
