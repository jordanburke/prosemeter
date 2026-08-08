---
kind: eval-artifact
run: 2
variant: E
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first request succeeded and you never found out. Idempotency is how you make the second attempt safe.

Here is the sequence. Your service sends the charge. The payment provider takes the money and writes the record. The response dies on the way back, or your client times out first. Your code sees no response, assumes failure, and retries. The provider sees a brand new request and charges again.

The key point: **a timeout tells you nothing about what happened on the other side.** It only tells you that you stopped waiting. The work may have completed, partly completed, or never started. You cannot tell them apart from the client.

Idempotency fixes this by making the retry the *same* request rather than a *new* one. You generate a unique key before the first attempt and send it with every try:

```
POST /charges
Idempotency-Key: 7f3a...c91
```

The provider stores that key with the result. On the retry it recognizes the key, skips the charge, and replays the original response. Same key means same outcome, no matter how many times you send it.

Three rules that make this work:

1. **Generate the key once, outside the retry loop.** A key created inside the loop is a new key each attempt, which is exactly the bug you have.
2. **Derive it from the business event, not the request.** The order id or a checkout-session id works well, because a genuine second purchase gets a genuine second key.
3. **Persist it before you send.** If your process crashes and restarts, it needs to recover the same key rather than mint a fresh one.

Also stop treating every failure as retryable. A `400` will fail the same way forever, so retrying it just burns time. Retry timeouts, `429`s, and `5xx`s with backoff and jitter. Leave the rest alone.
