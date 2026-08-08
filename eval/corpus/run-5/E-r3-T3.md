---
kind: eval-artifact
run: 5
variant: E
replicate: r3
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged the customer twice because the first request succeeded and you never found out. A timeout does not mean the work did not happen. It means you stopped waiting for the answer.

Picture the sequence. Your client sends the charge. The payment provider takes the money and starts writing the response. The connection drops, or your client's five-second deadline fires first. Your code sees an error, decides the charge failed, and sends it again. The provider sees a second, unrelated charge request and takes the money again. Both charges are real.

The problem is that a retry over an unreliable network is indistinguishable, from the sender's side, from a first attempt. Nothing in the second request says "this is the same intent as before." So the receiver has no way to tell a retry from a genuine second purchase, and it must assume the customer meant it.

Idempotency is the property that fixes this. An operation is idempotent when doing it twice leaves the same state as doing it once. Reading a row is naturally idempotent. Setting a balance to 50 is idempotent. Adding 50 to a balance is not, and neither is charging a card.

You make a non-idempotent operation safe to retry by attaching a key. The client generates a unique id for the *intent* — one id per checkout, not one per attempt — and sends it with the request. The server stores that key with the result of the first attempt. When a request arrives with a key it has seen, the server skips the work and returns the stored result. The retry gets the original outcome instead of a second charge.

Three rules make this actually work.

Generate the key before the first attempt and reuse it for every retry of that attempt. If your retry loop mints a fresh key each time, you have built the same bug with extra steps.

Store the key and the result in the same transaction as the charge. If you write the charge and then write the key, a crash between them leaves you unprotected exactly when it matters.

Handle the in-flight case. A retry can arrive while the first attempt is still running. The server should hold a lock on the key and either wait or return a "request in progress" status, not start a second charge.

Every serious payment API supports this already. Stripe takes an `Idempotency-Key` header. PayPal, Adyen, and Square have equivalents. Check whether you are simply not sending one — that is the common answer.

Two more things worth knowing.

Only retry when retrying is safe. Retry on connection failures, timeouts, 429s, and 5xx responses. Do not retry a 400; the request was wrong and will be wrong again.

Idempotency keys expire. Stripe holds them for 24 hours. That covers a retry loop and does not cover a customer clicking buy again next week — which is correct, because that time they meant it.
