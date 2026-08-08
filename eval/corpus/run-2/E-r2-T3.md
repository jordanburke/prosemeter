---
kind: eval-artifact
run: 2
variant: E
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first request succeeded and you never found out. The timeout told you the response was lost, not that the charge failed. You retried a request that had already worked.

This is the core problem with retries over a network. A failure gives you no information about what happened on the other side. The request may have died before reaching the provider, or after the charge posted but before the response came back. From your side both look identical.

Idempotency fixes this by making a repeated request land on the same result as the first one. You send a key with the charge, the provider stores the outcome under that key, and any later request with the same key returns the stored outcome instead of charging again.

```
POST /v1/charges
Idempotency-Key: 8f3c1e2a-...
```

The rules that make it actually work:

1. **Generate the key once, before the first attempt.** Every retry of that charge reuses it. A key generated inside the retry loop is a new key each time, which is exactly the bug you have.
2. **Derive the key from the business event**, not from the attempt. The order id, or a payment intent id, is a good source. Then a retry after a process restart still uses the same key.
3. **Persist the key with the order** before you call the provider. If you crash mid-call, recovery needs to find that key.
4. **Set a retry budget and use exponential backoff with jitter.** Retry on timeouts and 5xx. Do not retry on 4xx, because those will fail the same way again.

Also check your own endpoints. If a client can retry a call into your service, that call needs the same protection. Store the key and the response, return the stored response on a repeat, and reject a repeat key carrying a different payload.
