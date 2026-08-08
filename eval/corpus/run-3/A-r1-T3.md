---
kind: eval-artifact
run: 3
variant: A
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The bug is that your retry logic can't tell "the charge failed" apart from "the charge succeeded and I didn't hear back." Those look identical from the client — timeout, connection reset, 502 — and only one of them is safe to retry.

Walk the timeline:

1. You POST a charge.
2. The processor receives it, moves the money, writes the record.
3. The response gets lost. Network blip, load balancer timeout, your client's deadline fires at 10s and the processor took 11.
4. Your retry fires. The processor sees what looks like a brand new charge request, because as far as it can tell it *is* one.
5. Customer is charged twice.

Nothing malfunctioned. Every component did exactly what it was told. The failure is that "retry the request" is only a correct recovery strategy if the request is safe to run more than once — and by default, `POST /charges` is not.

**Idempotency** is the property that doing something twice has the same effect as doing it once. `DELETE /users/42` is naturally idempotent — the second call finds nothing to delete and the end state is the same. Creating a charge is naturally *not*, because each call is supposed to produce a new charge. That's the point of the endpoint.

So you make it idempotent artificially, by giving the request an identity the server can recognize on the way back in.

**How it works.** The client generates a unique key per logical operation — a UUID is fine — and sends it with the request:

```http
POST /v1/charges
Idempotency-Key: 9f8c2b31-4d6e-4a1f-b0c7-2e5a8d3f1c94

{ "amount": 4200, "currency": "usd", "source": "tok_..." }
```

The server, before doing any work, tries to claim that key — typically an insert into a table with a unique constraint on the key. Two outcomes:

- **Claim succeeds** → this is the first time. Process the charge, store the response body and status against the key, return it.
- **Claim fails** → this key has been seen. Return the *stored* response instead of charging again.

Your retry sends the **same key**, so attempt two hits the second branch and gets back the original charge — same charge id, same result. The customer is charged once. The client can't tell it retried, which is exactly what you want.

The critical detail people get wrong: **the key must be generated once, before the first attempt, and reused across every retry of that operation.** If you generate it inside the retry loop, every attempt gets a fresh key and you've built an elaborate way to change nothing. Generate it at the top, where you decide to charge, and carry it through.

A few things worth getting right:

- **Scope the key to the operation, not the session.** One key per "charge this customer for this order," not one per user or per day.
- **Handle the in-flight case.** If the retry arrives while the first attempt is still running, the key is claimed but there's no stored response yet. Return `409` and let the client back off — don't return an empty success.
- **Store failures too, but think about which ones.** A card decline is a real, deterministic outcome and replaying it is correct. An internal 500 arguably should be retryable rather than cached. Most APIs cache the terminal result and let 5xx fall through.
- **Expire keys.** 24 hours is the common window. Long enough to cover any sane retry schedule, short enough that the table doesn't grow forever.

**Check before you build it.** Stripe, Adyen, Braintree, Square all support idempotency keys already. If you're on one of those, this is a header you're not sending, not a system you need to write. If you're the one *exposing* the payment API, then yes, you're implementing the server side.

Last thing, unrelated to idempotency but relevant to your incident: retries also need backoff and jitter and a cap. Idempotency keeps a retry storm from double-charging anyone, but it won't keep it from taking down the processor.
