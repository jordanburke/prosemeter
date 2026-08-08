---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The thing that bit you is that a failed request and a request whose response you didn't receive look identical from the client side, and they are not the same event.

Your retry logic sees a timeout, or a 504, or a dropped connection, and concludes "that didn't happen, try again." But the charge very likely *did* happen. The request reached the payment processor, the card was charged, and the response got lost on the way back — timeout on your side, load balancer reaped the connection, pod got rescheduled mid-flight, whatever. You retried a thing that had already succeeded. Two charges.

This isn't a bug in your retry code exactly. It's that retrying is only safe for operations where doing it twice equals doing it once. That property is idempotency. `DELETE /users/42` is idempotent — run it five times, the user is deleted, same end state. `POST /charges` is not: run it five times and you've moved money five times.

**The fix is an idempotency key.** You generate a unique key for each *logical* charge attempt — one key per "the user clicked Pay on order 8815", not one per HTTP request — and send it with every attempt, including retries:

```
POST /v1/charges
Idempotency-Key: 6a5c1f3e-... (same value on every retry)
```

The processor stores the key alongside the result of the first request it sees. When a second request arrives with a key it's already seen, it doesn't perform the charge again — it returns the stored response from the original. Your retry becomes safe because the *server* now knows the two requests are the same event, which is information the client can never establish on its own.

Every serious payment API supports this. Stripe uses the `Idempotency-Key` header exactly as above; Adyen and Braintree have equivalents. If your team is calling one of these and not sending the key, that's the whole bug and it's a small change.

Details that matter in practice:

- **Generate the key at the point of intent, not the point of sending.** If you mint a fresh UUID inside the retry loop, every attempt gets a different key and you've built the same bug with extra steps. Key belongs to the order/cart/user-action, and it needs to survive across retries, process restarts, and ideally the user hitting the button twice.
- **Only retry when it's plausibly safe.** Connection refused before any bytes went out is genuinely safe to retry. A timeout is ambiguous — the key is what makes it safe. A 400 is never worth retrying; you'll get the same 400.
- **Same problem exists in your own database.** If your charge handler writes a row and the handler runs twice, you need a unique constraint on something — the idempotency key, or `(order_id, attempt)` — so the second write fails loudly instead of duplicating. Don't rely on a `SELECT` then `INSERT`; two concurrent retries will both pass the select.
- **Add jitter and a cap while you're in there.** Unbounded immediate retries against a service that's already struggling is how a slow dependency becomes an outage.

For the duplicates you already created: the processor's API will let you list charges by idempotency key or by metadata, so you should be able to identify the pairs and refund the extras. Worth doing that reconciliation before shipping the fix, so you know the blast radius.
