---
kind: eval-artifact
run: 5
variant: E
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged the customer twice because the first request succeeded and you never found out. Idempotency is the fix: it lets the server recognize the retry as the same charge and return the original result instead of making a new one.

Here is the sequence. Your client sends a charge. The payment provider takes the money. The response gets lost — a timeout, a dropped connection, a load balancer that gave up. Your client sees a failure, so it retries. The provider sees a second, perfectly valid charge request and takes the money again.

The root problem is that a timeout tells you nothing. It does not mean the request failed. It means you do not know. The request may have never arrived, may have arrived and failed, or may have fully succeeded with only the reply lost. Retrying is safe in the first two cases and wrong in the third, and you cannot tell them apart from the client.

An idempotent operation is one where doing it twice has the same effect as doing it once. Charging a card is not naturally idempotent, so you have to make it so.

You do that with an idempotency key. Your client generates a unique id for the charge — a UUID — before the first attempt. It sends that key with the request, and sends the *same* key on every retry of that same charge. The server stores the key with the result. When a request arrives with a key it has already seen, it skips the work and replays the stored response.

Four rules make it actually work.

Generate the key once, per logical operation, on the client. If you regenerate on retry, you have gained nothing. Tie it to the thing being paid for — the order id, the invoice — not to the attempt.

Write the key and the result in the same transaction as the charge. If you record the charge and then crash before recording the key, a retry charges again. One atomic write, or the guarantee has a hole in it.

Handle the concurrent case. Two retries can land at once, before either finishes. Insert the key first with a unique constraint, so the second request hits the conflict and waits for or reads the first one's result rather than starting its own.

Store the response, not just a "seen" flag. The retry needs the original charge id to return to the caller.

Two things to check. Most providers already support this — Stripe takes an `Idempotency-Key` header, and so do Adyen and Square. Use theirs rather than building your own. And give keys an expiry, usually 24 hours, so the table does not grow forever; just make sure the window is longer than your longest retry schedule.

One caveat. Idempotency keys protect against a repeated request. They do not protect against a user clicking Pay twice, because that is genuinely two operations from the client's view. For that, key on the order rather than the request.
