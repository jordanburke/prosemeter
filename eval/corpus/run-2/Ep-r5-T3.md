---
kind: eval-artifact
run: 2
variant: Ep
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first request probably succeeded. A timeout tells you that you did not get an answer. It does not tell you the work did not happen.

Here is the sequence you almost certainly hit:

1. You send the charge request.
2. The payment provider receives it and charges the card.
3. The response is lost — network blip, load balancer timeout, your client giving up at 10 seconds while the provider takes 12.
4. Your code sees a timeout and retries.
5. The provider receives what looks like a brand-new charge request and charges the card again.

The provider did nothing wrong. It has no way to tell your retry apart from a customer legitimately buying the same thing twice.

**Idempotency is the fix.** An idempotent operation gives the same result whether you run it once or ten times. You make a charge idempotent by attaching a unique key that identifies the *intent*, not the attempt:

```
POST /charges
Idempotency-Key: 8f14e45f-ea23-4b98-9c1a-3d7e2b1a0000
```

The provider stores that key with the result of the first request. When a request arrives with a key it has already seen, it skips the work and returns the stored response. Stripe, Adyen, and Square all support this; check your provider's docs for the exact header.

Three rules decide whether this actually saves you:

- **Generate the key before the first attempt, and reuse it across every retry.** A key generated fresh inside the retry loop is a new key each time, which defeats the whole mechanism.
- **Derive it from the business intent, not from randomness alone.** Key on the order or cart, so a user double-clicking Pay reuses the key too. A random UUID per button press still double-charges.
- **Persist it before you send.** If your process crashes mid-request and restarts, it needs to find the same key to retry safely.

One thing to watch: idempotency keys expire, usually after 24 hours. A retry after the window is a new charge again, so keep your retry window well inside it.

Also, only retry on timeouts, 5xx responses, and connection errors. A 4xx means the provider understood you and said no — retrying that just burns rate limit.
