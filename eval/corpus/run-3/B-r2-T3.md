---
kind: eval-artifact
run: 3
variant: B
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The bug is that a failed request and a lost response look identical from your side.

You sent the charge. The connection timed out. You don't know which of these happened:

- The request never arrived. Nothing was charged. Retrying is correct.
- The request arrived, the charge succeeded, and the *response* got lost on the way back. Retrying charges the customer twice.

Your retry logic assumed the first one. Sometimes it was the second one. Hence the duplicates.

This isn't fixable by being smarter about when to retry — you genuinely cannot tell the two cases apart from the client. The information isn't there. What you can do is make the retry harmless either way.

**That's what idempotency means:** doing the operation twice has the same effect as doing it once. `DELETE /order/123` is naturally idempotent — delete it twice, it's still just deleted. `POST /charge $50` is not. Each call is a new charge.

The standard fix is an **idempotency key**. You generate a unique ID for the *logical operation* — not per HTTP attempt — and send it with every retry of that operation:

```
POST /charges
Idempotency-Key: 7f3a9c21-...
{ "amount": 5000, "currency": "usd" }
```

The server stores that key alongside the result. First time it sees the key, it does the work and records the outcome. Every subsequent time, it skips the work and replays the stored response. Your retry gets back the same charge ID as the original, the customer is charged once, and you never had to know which failure case you were in.

Three details that matter in practice:

- **Generate the key before the first attempt, and reuse it for all retries.** If you generate a fresh key per attempt you've built the same bug with extra steps. The key identifies "this checkout," not "this HTTP call."
- **Write the key and the charge in the same transaction.** Otherwise there's a window where you charged but haven't recorded the key yet, and a retry lands in it. A unique constraint on the key column is what actually enforces this — two concurrent retries race, one inserts, the other hits the constraint and reads the winner's result.
- **The key needs to cover the request body too.** If someone reuses a key with a different amount, that's a client bug and the server should reject it rather than silently returning the old charge.

Worth checking: most payment providers already support this — Stripe, Adyen, and others take an `Idempotency-Key` header and handle the dedup for you. If you're calling one of those, you may not need to build the storage layer at all, just start sending the header. Check your provider's docs before writing anything.
