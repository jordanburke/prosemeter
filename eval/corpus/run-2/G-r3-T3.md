---
kind: eval-artifact
run: 2
variant: G
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first request worked and you never found out. Idempotency is the fix, and it is the only real one.

Here is the failure. Your service sends the charge. The payment provider takes it, writes it down, and sends back a success. That reply dies on the way home, or your client gives up first on a timeout. Your code sees no answer, calls it a failure, and retries. The provider sees a brand new charge request and charges the card again.

The key point: **a timeout does not tell you the request failed.** It tells you that you do not know. Those are different, and retry logic that treats them the same will double-charge every time the network hiccups.

**Idempotency means a repeated request has the same effect as one request.** You send a unique key with the charge. The provider stores that key with the result. If a second request arrives with a key it has seen, it skips the work and replays the stored response. Your retry gets back the *original* charge, not a new one.

**How to do it:**

1. **Generate the key before the first attempt**, from the thing being paid for — the order id works well. Derive it once and reuse it for every retry of that charge.
2. **Never generate a fresh key inside the retry loop.** That is the same bug with extra steps.
3. **Send it on every attempt**, usually as an `Idempotency-Key` header. Stripe, Adyen, and Square all support this.
4. **Persist the key with your order** before you call out. If your own process dies mid-retry, the replacement needs the same key.

Keys should live at least as long as your retry window, and most providers hold them for 24 hours.

**Two things to fix while you are in there.** Retry only on timeouts, connection errors, and 5xx responses, because a 4xx means the provider rejected the request and it will reject it again. And back off between attempts, so a slow provider does not get hammered by every client at once.

**One caveat.** Idempotency has to be built into the endpoint you call. If your provider does not support it, you need a reconciliation pass instead — search their API for a charge matching your order id before you retry, and skip the retry when you find one.
