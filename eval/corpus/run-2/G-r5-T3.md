---
kind: eval-artifact
run: 2
variant: G
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged the card twice because the first call succeeded and you never found out. Idempotency is the fix: it lets the payment provider recognize the retry as the same charge and return the first result instead of making a new one.

Here is the failure. Your code sends the charge. The provider takes the money and starts writing the response. Then the connection drops, or your client times out at 10 seconds while the provider takes 12. Your code sees an error and retries. The provider sees a brand new charge request and, correctly, charges again.

The key point: **a timeout is not a failure.** It tells you nothing about what happened on the other side. The request may have never landed, or it may have landed and done the work. Your retry logic treated an unknown outcome as a known failure, and that is where the money went.

The fix is an idempotency key. You generate a unique id for the *intent to charge*, not for the attempt, and send it with every try:

```
POST /charges
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

The provider stores that key with the result of the first request. When the same key arrives again, it skips the work and replays the stored response. Stripe, Adyen, and most others support this. Check your provider's docs for the exact header and how long they keep the key.

Two rules that people get wrong:

1. **Generate the key once, upstream, and reuse it across every retry.** If you make a fresh key inside the retry loop, you have built the same bug with more steps. Tie the key to the order or the checkout session, and store it with your own record before you make the first call.
2. **Retry the same key on timeouts, not just on connection errors.** The timeout case is the one that needs it most.

Also add reconciliation. Idempotency keys expire, often after 24 hours, and they do not help if your process dies before the key is written down. So keep your own record of the charge intent before you call out, and run a job that compares your intents against the provider's charge list to catch drift.

One more thing worth checking while you are in there: make sure you are not retrying on 4xx responses. Those are your bug, not a blip, and retrying them just burns rate limit.
