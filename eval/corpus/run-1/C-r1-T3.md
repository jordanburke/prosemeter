---
kind: eval-artifact
run: 1
variant: C
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The retry didn't double the charge on its own. The lost reply did.

Picture it. You call the charge API. The gateway takes the money, then the reply dies — a timeout, a dropped conn, a 502 from some proxy. Your code sees a failure and fires again. The gateway sees a brand new charge and takes the money again. From where it sits, nothing went wrong at all.

That's the trap: a timeout tells you nothing about whether the work happened.

Idempotency closes the gap. You send a key with the request. The gateway stores that key next to the result of the first call. If the same key shows up again, it skips the work and hands back the first result. One key, one charge, however many times you send it.

The part people get wrong:

```ts
// wrong — a new key per attempt, so each retry is a new charge
retry(() => charge({ idempotencyKey: crypto.randomUUID() }))

// right — one key per logical charge, reused on every attempt
const key = crypto.randomUUID()
retry(() => charge({ idempotencyKey: key }))
```

Make the key once, above the retry loop. Better still, derive it from the thing you're paying for — order id, invoice id — so a double-click on the button reuses it too. Save it with the order, so a retry after a crash or a deploy still sends the same key.

Two more rules. Retry only on timeouts, 5xx, and conn errors; a 400 or 402 will fail the same way forever. And back off between tries, so you don't pound a gateway that's already sick.
