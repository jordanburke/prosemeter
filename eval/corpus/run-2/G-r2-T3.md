---
kind: eval-artifact
run: 2
variant: G
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry logic charged twice because a failed request is not the same as a failed charge. The first call probably worked. The response just never got back to you.

Walk the timeline. You send the charge. The payment provider takes the money. The response times out, or the socket drops, or a load balancer kills the connection. Your code sees an error and retries. The provider sees a second, unrelated charge request and takes the money again.

The core problem is that a network error tells you nothing about what happened on the other side. It splits into three cases you cannot tell apart from the client:

1. The request never arrived. Retrying is correct.
2. The request arrived and failed. Retrying is correct.
3. The request arrived and succeeded, and the reply was lost. Retrying double-charges.

You retried all three the same way. Case 3 cost you.

**Idempotency** is the property that doing something twice has the same effect as doing it once. `DELETE /user/42` is naturally idempotent. Charging a card is not, because each call moves money.

You make it idempotent by giving each **logical** charge a unique key, and having the server dedupe on that key. Stripe calls it `Idempotency-Key`; most providers have an equivalent header or field.

The flow works like this. You generate a key for the charge, once. You send it on the first attempt and on every retry of that same charge. The server records the key with the result. On a repeat key it skips the work and replays the stored response.

The part people get wrong is **where the key comes from**. Generate it before the first attempt and store it with the thing you are charging for, like the order row. Do not generate it inside the retry loop, and do not generate it fresh when the user clicks again after a page reload. A key created per attempt makes every retry look new, which is exactly the bug you have.

Two more rules that matter in practice:

- **Scope the key to the operation, not the session.** Same order, same key, forever. If the amount changes, that is a different charge and deserves a different key.
- **Give it a real lifetime.** Providers usually hold keys for 24 hours or so. Retries that outlive that window are no longer protected, so treat a very late retry as a new decision, not an automatic resend.

If your own service is the one taking payments, build the same thing. Add a unique constraint on the idempotency key in your charges table. Insert the key first, then charge. A duplicate-key error means the work already happened, so return the stored result instead of charging again. The database constraint is what makes it safe when two retries race in parallel.

Last thing: once the keys are in, you can retry freely. That is the real payoff. Idempotency is what turns retries from a risk into a routine.
