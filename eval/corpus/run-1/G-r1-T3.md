---
kind: eval-artifact
run: 1
variant: G
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired on requests that had already succeeded. A timeout tells you that you didn't hear back — it does not tell you the charge didn't happen. The payment processor took the first request, charged the card, and the response died on the way home. Your code saw no response, assumed failure, and sent the charge again.

This is the core problem with retries over a network. You have three possible states after a failed call: it never arrived, it arrived and failed, or it arrived and worked. From the caller's side, all three look identical. Retrying is right for the first two and wrong for the third, and you can't tell them apart.

Idempotency closes that gap. An idempotent operation gives the same result no matter how many times you run it. Setting a balance to $50 is idempotent. Adding $50 is not. Charges are naturally in the second group, so you have to make them behave like the first.

The way you do that is an **idempotency key**. You generate a unique id for the charge attempt — once, before the first send — and attach it to every retry of that same charge:

```ts
const key = crypto.randomUUID()   // per charge, NOT per attempt

await stripe.charges.create(
  { amount, currency, source },
  { idempotencyKey: key },
)
```

The server stores the key with the result. First request with a new key: it does the work and saves what happened. Any later request with the same key: it skips the work and returns the saved result. Your retry now returns the original charge instead of making a new one.

Two details that people get wrong:

- **Generate the key outside the retry loop.** A key generated per attempt is a new key every time, which is exactly what you were doing already.
- **Make the key survive a crash.** If your process dies mid-retry and restarts, it needs the same key. Derive it from something stable — the order id — or write it to the database before you send.

Check whether your processor already supports this. Stripe, Adyen, and Square all do. If it does, this is a small change. Then go find the duplicate charges from the incident and refund them, because idempotency only protects you going forward.
