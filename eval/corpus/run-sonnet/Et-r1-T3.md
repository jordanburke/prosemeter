---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The retry fired a second real charge because the network, not the payment, was what failed. Here's the usual sequence: your client sends a charge request, the payment provider processes it and charges the card, but the response back to you times out or drops. Your code sees no response, assumes failure, and retries. The provider gets a brand-new request and, having no way to tell it apart from the first one, charges the card again.

Idempotency fixes this by letting you tell the provider "this is the same request, not a new one." You generate a unique idempotency key per logical operation (a UUID tied to the order or attempt, generated once, before the first try) and send it with every retry of that same operation. The provider stores the key with the result of the first successful charge. When a retry arrives with a key it has seen before, it returns the original result instead of charging again.

What to change:

1. Generate the idempotency key once, upstream of the retry loop, not inside it.
2. Pass that same key on every retry of the same logical charge.
3. Confirm your payment provider's API supports idempotency keys (Stripe, for example, takes one via the `Idempotency-Key` header).
4. Never retry on ambiguous failures (timeouts) without a key — that's exactly the case that causes double charges.
