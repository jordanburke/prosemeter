---
kind: eval-artifact
run: 2
variant: Ep
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because a failed response does not mean a failed charge. The request reached the payment provider, the provider charged the card, and then the response got lost on the way back — timeout, dropped connection, a 502 from something in between. Your code saw no success, so it retried, and the provider had no way to know the second request was the same charge as the first.

This is the core problem: **you cannot tell "it never happened" apart from "it happened and I did not hear back."** Both look identical from the client. Any retry policy that assumes the first case will double-charge whenever it is really the second.

Idempotency is the fix. An idempotent operation produces the same result whether you run it once or five times. Charging a card is not naturally idempotent, so you make it idempotent by attaching a key.

**How it works:**

1. Generate a unique key for the logical charge — one key per checkout attempt, not per HTTP request. A UUID stored with your order record works.
2. Send it as `Idempotency-Key` on the charge request.
3. Retry with **the same key**. Every retry of that charge carries the identical value.
4. The provider records the key with the result. On seeing a key it has already processed, it returns the original response instead of charging again.

The critical detail is where the key comes from. Generating it inside the retry loop defeats the whole thing, because each attempt gets a fresh key and the provider sees distinct charges. Generate it once, before the first attempt, and persist it so it survives a process restart mid-retry.

**Two more things to get right.** Only retry on errors that might be transient — timeouts, 5xx, connection resets. A 4xx means the provider rejected it deliberately, and retrying just burns quota. And when you get back a stored response for a duplicate key, treat it as success; a lot of code path-checks for "did I create this" and blows up on the replay.

Stripe, Adyen, and Square all support idempotency keys. Check the docs for how long yours retains them — typically 24 hours — because a retry after the window expires charges again.
