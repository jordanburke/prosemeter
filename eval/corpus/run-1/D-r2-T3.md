---
kind: eval-artifact
run: 1
variant: D
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The bug is that you're treating a timeout as "it didn't happen," when a timeout actually means "I don't know what happened."

Walk through the failure. You POST a charge. The payment processor receives it, charges the card, starts writing the response... and the connection drops, or your client-side timeout fires at 10s while their processing took 12s. From your side, all you saw was an error. So you retry. From *their* side, they got two perfectly valid charge requests and did exactly what you asked twice.

The general shape of this: any network call has three outcomes, not two — success, definite failure, and **unknown**. Retrying is correct for definite failures (connection refused, DNS failure, a 503 before the request was processed). Retrying an unknown is a gamble, and for anything that moves money the gamble loses.

You can't eliminate the unknown — there's no way to make "send request" and "learn the outcome" a single atomic step over a network. So instead of trying to send exactly once, you accept that you'll sometimes send twice and make the *second* send harmless. That's idempotency: an operation you can apply N times and the state ends up the same as applying it once.

`GET` and `DELETE` are naturally idempotent. "Charge $50" is not — it's a relative operation, it moves the balance each time. You make it idempotent by attaching an identity to the *attempt* so the server can recognize a repeat:

```
POST /v1/charges
Idempotency-Key: 8f2b1c9e-...
```

The server keeps a table keyed on that value. First time it sees the key, it does the work and stores the response against the key. Any later request with the same key skips the work and replays the stored response. Your retry gets back the same charge object, same charge ID, and the customer got billed once.

The part people get wrong, and it's the whole thing: **the key has to be generated once per logical operation, not once per HTTP attempt.** If your retry wrapper mints a fresh UUID on each try, you've built an elaborate no-op. Generate it when the user clicks Pay, hold it in the request object, and reuse the identical value for every retry of that intent. If you can derive it from something stable — the order ID, or `hash(user, cart, amount)` — even better, because then the key survives your process crashing and restarting mid-retry.

Rest of the checklist:

- **Persist the key before you send the request**, not after. If you crash between sending and recording, you need to come back knowing what key was in flight.
- **Put a unique constraint on the key column** in your own dedupe table if you're the server side. Two retries can arrive concurrently — two in-flight requests both check "does this key exist," both see no, both charge. The database constraint is what actually makes it safe; an application-level check is a race. Insert-then-work, and let the constraint violation tell you it's a duplicate.
- **Only retry what's worth retrying.** Timeouts, 429s, 5xx — yes, with exponential backoff and jitter. A 400 or a card decline is a real answer; retrying just annoys everyone and can trip fraud rules.
- **Keys expire.** Stripe holds them 24 hours, most processors are similar. A retry three days later is a new charge as far as they're concerned. Fine for a request retry loop; not a substitute for reconciliation.
- **Reconcile anyway.** Idempotency keys close the window; they don't make it zero. A daily job comparing your ledger against the processor's settlement report is how you catch the leftovers.

If your processor is Stripe/Adyen/Braintree, they all support this header already — you likely just aren't sending it. That's often a one-line fix plus the discipline of generating the key in the right place.
