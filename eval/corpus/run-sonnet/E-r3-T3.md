---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T3
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired a second charge because the payment API had no way to tell "this is a new charge" apart from "this is the same charge again." That's what idempotency fixes.

Here's the failure sequence: your code calls the charge API, the charge succeeds on the payment provider's side, but the response gets lost — a timeout, a dropped connection, a proxy hiccup. Your code sees no response, assumes failure, and retries. The provider has no record that this retry is "the same request," so it processes it as a brand new charge. The customer pays twice.

An idempotency key fixes this by giving each logical operation a stable ID that you generate once and send with every attempt. You create a unique key (a UUID works) before the first try, then send that same key on the original call and every retry. The payment provider stores the key with the result of the first successful charge. When a retry arrives with a key it has already seen, it returns the original result instead of charging again.

The rule going forward: any write that might get retried — payments, order creation, anything with a side effect — needs an idempotency key generated once per logical operation, not once per attempt. Most payment providers (Stripe, for example) support this natively; check if yours does before you build your own.
