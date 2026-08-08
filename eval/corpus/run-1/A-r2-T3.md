---
kind: eval-artifact
run: 1
variant: A
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus,sonnet"
  error: "Claims Square accepts an idempotency key header. Square takes idempotency_key as a request-body field."
---
The short version: your retry logic is correct, and the endpoint you're retrying against isn't safe to retry. Those two things together produce double charges. It's not a bug in either piece in isolation — it's a missing contract between them.

**What actually happened**

You sent a charge request. Something went wrong — a timeout, a 503, a dropped connection — so your code retried. But a failed *response* is not the same as a failed *request*. There are two very different states that look identical from your side:

1. The request never reached the processor. Retrying is correct.
2. The request reached the processor, the card was charged, and the *response* died on the way back (timeout, load balancer reset, your pod got OOM-killed mid-read).

In case 2, the retry charges the card a second time. You cannot tell 1 from 2 from the client. That ambiguity is permanent and unfixable at the network layer — this is the classic two generals problem, and no amount of cleverness in the retry loop resolves it.

Timeouts are the nastiest of these, because a timeout is the *most likely* failure mode to actually mean "it worked, slowly." Charges are slow operations. A 5-second client timeout against a processor that took 6 seconds to succeed will generate duplicates all day long.

**Where idempotency comes in**

Since the client can't tell whether the first attempt succeeded, the *server* has to. Idempotency means: performing the operation N times has the same effect as performing it once. You get it by having the client generate a unique key per logical operation and send it with every attempt, including retries.

```
POST /v1/charges
Idempotency-Key: 9f3c1a7e-...    # generated ONCE, reused on every retry
{ "amount": 4999, "currency": "usd", "source": "tok_..." }
```

Server-side, the flow is:

1. Look up the key. If a completed result exists, return the *stored original response* — don't re-execute anything.
2. If the key doesn't exist, insert it in a single atomic step with the charge (same transaction, or a unique constraint on the key column) and execute.
3. If the key exists but is still in-flight, either block briefly or return a 409 telling the caller to retry later.

Step 2 is where most homegrown implementations go wrong. If you check-then-act as two separate steps, two concurrent retries both see "not found" and both charge. The uniqueness has to be enforced by the database — a `UNIQUE` constraint on the idempotency key, with the insert in the same transaction as the charge. Let the second one fail the constraint and read back the first one's result.

**The critical detail people miss**

The key must be generated **once per logical intent** and reused across retries. If you generate a fresh UUID inside your retry loop, you've built an elaborate no-op. Generate it at the point where the user clicks "pay" — before the first attempt — and carry it through every retry, including retries that happen after a process restart. Which means it needs to be durable: persisted with your order record, not held in memory.

Also worth pinning down:
- **Scope the key to the request body.** If the same key arrives with a different amount, that's a client bug — return an error rather than silently replaying the old response.
- **Store the response, not just a flag.** The retry needs to receive the original charge ID, not a bare "already done."
- **Set a retention window.** Stripe holds keys 24h. Long enough to cover any plausible retry, short enough that the table doesn't grow forever.

**What to do right now**

Check whether your processor already supports this — Stripe, Adyen, Square, and PayPal all accept an idempotency key header, and if you're calling one of them the fix is genuinely just "send the header, generate it in the right place." If it's your own internal payment service, you need the key table with the unique constraint.

Until that's in, the safer interim posture is: **don't blind-retry writes.** On timeout, query for the charge by your own order reference and reconcile, rather than firing again. Slower, but it won't double-charge anyone.

And separately from the fix — you'll want to find the customers already affected and refund them before support does. A dupe-detection query over charges grouped by (customer, amount, ~time window) will find them.
