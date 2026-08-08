---
kind: eval-artifact
run: 2
variant: G
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first request succeeded and you never found out. The network dropped the response, not the charge.

Walk the timeline. Your client sends the charge. The payment service receives it, moves the money, and sends back a 200. The response dies in transit — a timeout, a dropped connection, a load balancer that gave up. Your client sees no response and concludes the charge failed. It retries. The payment service receives what looks like a brand new charge request and moves the money again.

The key point: **a timeout tells you nothing about whether the work happened.** It only tells you that you didn't hear back. Failed-before-doing and succeeded-but-lost-the-reply look identical from the client. Retrying is right in the first case and wrong in the second, and you cannot tell them apart from where you're standing.

Idempotency closes that gap. You attach a unique key to the request — a UUID your client generates once, before the first attempt. The payment service stores that key with the result. On any request carrying a key it has already seen, it skips the work and replays the stored response. Your retry now returns the original charge instead of making a new one.

The part people get wrong: **the key must be generated once for the operation, not once per attempt.** Generate it inside the retry loop and every attempt gets a fresh key, which is exactly the bug you have. Generate it when the user clicks Pay, then reuse the same value for every retry of that payment.

```
// wrong — new key each attempt
retry(() => charge({ idempotencyKey: uuid(), amount }))

// right — one key for the whole operation
const key = uuid()
retry(() => charge({ idempotencyKey: key, amount }))
```

Stripe, Adyen, and most payment APIs already support this through an `Idempotency-Key` header. Check your provider's docs — you may just need to start sending it.

Two things to watch:

- **Keys expire.** Stripe holds them for 24 hours. A retry after the window is a new charge, so don't build slow retry schedules on top of this.
- **Persist the key if the operation can outlive the process.** A key held only in memory is gone after a crash, and the restarted job charges again. Write it to your database in the same transaction that records the intent to charge.

Also worth checking now: whether anything else in your system retries writes without a key. Order creation, transfers, refunds — same failure mode, same fix.
