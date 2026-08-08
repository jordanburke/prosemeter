---
kind: eval-artifact
run: 2
variant: Ep
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry logic charged twice because a failed request is not the same as a failed charge. The first call probably succeeded. You just never heard about it.

Picture the timeline. Your service posts a charge. The payment provider takes the money and writes the record. The response dies on the way back — timeout, dropped connection, load balancer reset, your client's deadline. Your code sees an error, assumes nothing happened, and retries. The provider sees a second, unrelated charge request and charges again.

The core problem: **you cannot tell "the request never arrived" apart from "the response never came back."** Both look identical from the caller's side. Retrying is right for the first case and wrong for the second, and you have no way to know which one you are in.

Idempotency closes that gap. You attach a key to the request — a UUID you generate *once*, before the first attempt, and reuse on every retry of that same logical charge:

```
POST /v1/charges
Idempotency-Key: 8f14e45f-ea2c-4f1b-9c3a-...
```

The provider stores the key with the result. On a repeat key it skips the work and replays the original response. Your retry now returns the *first* charge instead of making a second one. Same key, same outcome, however many times you send it.

Four things to get right:

- **Generate the key before the first attempt, not inside the retry loop.** A fresh key per attempt does nothing.
- **Tie the key to the business action, not the HTTP call.** One key per "customer pays for order 1234."
- **Persist the key with your order record** before you call out. If your own process crashes mid-request, the retry after restart needs to find the same key.
- **Check the expiry window.** Stripe holds keys for 24 hours; others differ. A retry after the window is a new charge.

Two more notes. Idempotency keys are not a substitute for reconciliation — pull the provider's records and compare against yours, because that is what catches the cases the keys miss. And do not retry on a `4xx`: those mean the request was wrong, and sending it again just makes it wrong twice.
