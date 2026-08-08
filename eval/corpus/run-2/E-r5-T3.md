---
kind: eval-artifact
run: 2
variant: E
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry logic double-charged because a timeout does not tell you the charge failed. It only tells you that you stopped waiting for the answer.

Here is the sequence. You send the charge. The processor receives it, charges the card, and starts writing the response. The network drops, or your client hits its timeout. You see an error, so you retry. The processor receives what looks like a brand new charge request and charges the card again.

The failure mode is that **you cannot tell "never happened" apart from "happened, answer lost"** from the client side. Retrying is safe for the first case and harmful for the second. Your code treated them as the same.

Idempotency fixes this by making the retry *be* the original request rather than a new one. You generate a key before the first attempt — a UUID, tied to the business intent, like the checkout attempt — and send the same key on every retry:

```
POST /charges
Idempotency-Key: 9f2b1c74-...
```

The processor stores the key with the result. On the first request it charges and saves the response under the key. On a retry with the same key it skips the charge and replays the saved response. You get the same answer you would have gotten the first time, and the card gets charged once.

Three rules make this actually work:

**Generate the key before the first attempt, not inside the retry loop.** A key generated per attempt is just a new request with extra steps. This is the mistake I see most.

**Tie the key to the business action, not the HTTP call.** One key per checkout attempt. If the user genuinely clicks pay twice for two separate purchases, those are two keys.

**Persist the key** somewhere that survives a process restart, if your retries can span one.

Stripe, Adyen, and Square all support this header. Check whether the one you use also has a retention window — Stripe's keys expire after 24 hours, so a retry a day later is a fresh charge.

For your own endpoints, the same idea applies inward. Any handler that moves money or sends a message should take a key and store it in the same transaction as the effect. Storing them separately reopens the hole you just closed.
