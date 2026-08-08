---
kind: eval-artifact
run: 5
variant: L
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry sent a second charge request because the first one succeeded and you never saw the answer. Idempotency is the fix: it lets the payment provider recognize the retry as the same charge and return the original result instead of charging again.

Here is the failure. Your code posts a charge. The provider takes the money. The response gets lost — a timeout, a dropped connection, a pod that restarted. Your code sees no response, assumes failure, and posts again. The provider has no way to tell that second request apart from a customer who genuinely wants to pay twice, so it charges twice.

The root cause is that a timeout is not a failure. A timeout tells you nothing about what happened on the other side. The request may have never arrived, or it may have completed perfectly. You cannot tell the two apart from your side, and retrying is only safe in one of those cases.

An idempotent operation gives the same result no matter how many times you run it. `set balance to 100` is idempotent. `add 100 to balance` is not. Charging is naturally the second kind, so you have to make it behave like the first.

You do that with an idempotency key. Generate a unique value — a UUID — for each *intent to charge*, and send it with every attempt including the retries. The provider stores the key with the result of the first request. When the key shows up again, it returns the stored result and does nothing else.

Three rules decide whether this actually works.

- **Generate the key before the first attempt, and reuse it.** A key generated inside the retry loop is a new key each time, which is the bug you already have.
- **Tie the key to the business action, not the HTTP call.** One key per checkout, per order, per invoice. If the user clicks Pay twice on purpose, that is two intents and two keys.
- **Store the key where a crash cannot lose it.** Put it in your database next to the order, in the same transaction that creates the order. A key held in memory dies with the process that was going to retry.

Stripe, Adyen, and Square all take an `Idempotency-Key` header. Check how long yours keeps keys — Stripe holds them 24 hours — because a retry after the window expires charges again.

One more thing to add. Retry only on timeouts, connection errors, and 5xx responses. A 4xx means the provider understood you and said no, so retrying just repeats the same rejection. Back off exponentially with jitter, and cap the attempts.
