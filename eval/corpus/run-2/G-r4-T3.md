---
kind: eval-artifact
run: 2
variant: G
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge because the first one worked. The response got lost, not the charge.

Here is the sequence. Your service posts a charge. The processor takes the money and writes the record. The reply dies on the way back — a timeout, a dropped connection, a load balancer giving up. Your code sees no response, assumes failure, and retries. The processor sees a fresh, valid charge request and takes the money again.

The key point: **a timeout tells you nothing about what the server did.** It only tells you that you stopped waiting. The request may have never landed, may be running right now, or may have finished perfectly. Retrying is a bet that it never landed, and you lose that bet some of the time.

Idempotency is the fix. An idempotent operation gives the same result whether you run it once or ten times. `set balance = 100` is idempotent. `add 100 to balance` is not. Charges are naturally in the second group, so you have to make them behave like the first.

You do that with an idempotency key. Your client makes one ID per charge attempt — a UUID, generated **before** the first send and reused for every retry of that same charge. You send it as a header:

```
Idempotency-Key: 7f3a9c2e-...
```

The server stores that key with the result. On a repeat key it skips the work and replays the stored response. So the caller gets the same answer twice and the customer pays once.

Three things trip people up:

- **Generating the key inside the retry loop.** Each retry then gets a fresh key and looks like a new charge. Generate it once, outside the loop, and pass it down.
- **Keying on request content instead of an explicit ID.** Two real charges for the same amount to the same merchant a minute apart are legitimate, and hashing the body collapses them into one.
- **Assuming the processor handles it for you.** Stripe, Adyen, and Square all support idempotency keys, but only when you send one. No key means no protection.

Check your processor's docs now and confirm you are sending the header. Then trace where the key is created in your code. If it is inside the retry, that is your bug, and moving one line fixes it.
