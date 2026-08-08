---
kind: eval-artifact
run: 1
variant: G
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge because the first one probably worked. The response got lost, not the charge.

Walk through it. Your service posts a charge. The payment provider takes the money and starts writing the response. Then the connection drops, or your client hits its timeout, or a load balancer kills the socket. Your code sees a failure and retries. The provider sees a brand new charge request and takes the money again.

The core problem: **a timeout tells you nothing about what happened on the other side.** It only tells you that you stopped waiting. The request may have never arrived, may have half-run, or may have fully succeeded. Retrying is safe only when the server can tell "this is the same request again" from "this is a new request."

That's what idempotency gives you. An idempotent operation produces the same result whether you run it once or ten times. Some operations are naturally idempotent — `DELETE /users/42`, or setting a balance to 100. Charging a card is not, because each call means one more transfer.

You make it idempotent with a key. You generate a unique ID for the charge attempt, send it with the request, and send **the same ID** on every retry of that attempt:

```
POST /v1/charges
Idempotency-Key: 9c8f2a10-3f4b-4e2f-9a6e-1d7c5b8e3a11
```

The provider stores that key with the result. The first request charges the card and saves the outcome. Every later request with the same key returns the saved outcome and charges nothing. Stripe, Adyen, and most serious payment APIs support this. Check your provider's docs for the exact header.

Three details that people get wrong:

- **Generate the key before the first attempt, not inside the retry loop.** A fresh UUID per attempt is the exact bug you already have, just with extra ceremony.
- **Tie the key to the business action, not the HTTP call.** One key per "checkout for order 5512," derived from the order ID if you can. That way a retry from a different process or after a restart still collapses onto the same charge.
- **Store the key on your side too.** If your service crashes mid-retry, the key has to survive the restart. Write it to the same database row that tracks the order, in the same transaction.

Also fix the failure handling around it. Don't retry on `400` responses; the request was wrong and will stay wrong. Do retry on timeouts, `5xx`, and connection errors. Use exponential backoff with jitter so a provider blip doesn't turn into your whole fleet hammering them in lockstep. And cap the attempts, then push the charge to a queue a human or a job can inspect.

Last thing: go check your data. If this shipped, you likely have real duplicate charges to refund, and finding them is more urgent than the code fix.
