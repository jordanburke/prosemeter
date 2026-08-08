---
kind: eval-artifact
run: 1
variant: B
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus,sonnet"
  error: "Same Square header error; advises sending a header that Square would ignore."
---
The root cause: **a failed request is not the same thing as a request that didn't happen.**

Your retry fired because you got a timeout or a 500 or a dropped connection. But those tell you that *you didn't hear back* — not that the charge didn't go through. The most common version is:

1. You send "charge $50."
2. The processor receives it, charges the card, starts writing the response.
3. The connection drops, or you hit your read timeout at 10s and the processor takes 12s.
4. Your code sees a failure and retries.
5. The processor receives what looks like a brand-new "charge $50" and does it again.

From the processor's side, nothing went wrong either time. It got two valid instructions and followed both.

**Idempotency** is the property that doing something twice has the same effect as doing it once. `DELETE /users/5` is naturally idempotent — delete an already-deleted user and the world ends up the same. `charge $50` is not: the second one moves money.

The fix is to make the operation idempotent by attaching a key. You generate a unique ID for the *logical* attempt — not per HTTP request — and send it with every try:

```
POST /charges
Idempotency-Key: 8f3c2a91-...

{ "amount": 5000, "currency": "usd" }
```

The processor stores that key with the result. First time it sees it, it charges and records the outcome. Every later request with the same key returns the **stored original response** instead of charging again. Your retry becomes a safe read of what already happened.

Two details that matter and get missed:

- **Generate the key once, before the first attempt, and reuse it for all retries of that attempt.** If you generate a fresh UUID inside the retry loop, you've built exactly the bug you have now with extra steps. Derive it from something stable — the order ID, the invoice ID — or generate it at the top and pass it down.
- **Persist the key before you send.** If your service crashes mid-attempt and restarts, it needs to recover the same key, not invent a new one.

Stripe, Adyen, Square, and most payment APIs support this header already, so you likely don't need to build anything server-side — just start sending it.

For the immediate mess: reconcile against the processor's transaction list rather than your own logs, since your logs think those charges failed. Group by amount, card, and timestamp window to find the duplicates, then refund.
