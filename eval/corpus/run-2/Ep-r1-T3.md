---
kind: eval-artifact
run: 2
variant: Ep
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry could not tell a failed charge from a successful charge whose response got lost. It retried both, and the second case charged the customer twice.

Here is the sequence. Your service posts a charge. The processor takes the money and starts writing the response. The connection drops, or your client times out first, or a load balancer kills the socket. Your code sees an error and retries, exactly as written. The processor sees a brand-new charge request and takes the money again.

The bug is not in the retry. The bug is that a timeout is ambiguous — it tells you that you did not hear back, not that nothing happened. Any retry on an ambiguous failure duplicates the work unless the receiving side can recognize the repeat.

**Idempotency is that recognition.** You generate a unique key per logical charge — one key for "customer 42 pays $30 for order 918" — and send it with every attempt, including the retries. The processor stores the key with the result. First request with a new key: do the work, save the outcome under the key. Any later request with the same key: skip the work, return the saved outcome. The customer gets charged once no matter how many times you ask.

Getting it right turns on three details:

- **Generate the key before the first attempt, and reuse it.** A key generated inside the retry loop is a new key each time, which is the bug you already have. Persist it with the order so a retry after a process restart still uses the original.
- **Derive it from the intent, not the attempt.** Same order, same amount, same key. A genuine second purchase of the same item needs a different key, so store the key on the payment record rather than hashing the cart contents alone.
- **Make the whole path idempotent, not just the outbound call.** If you write your own ledger row after the charge succeeds, that write needs the same protection — a unique constraint on the key does it.

Stripe, Adyen, and Braintree all take an `Idempotency-Key` header. Check what your processor calls it and turn it on before you touch anything else.

Two more things worth fixing while you are in there. Add jitter to the retry backoff so a processor blip does not bring every one of your workers back at the same instant. And do not retry on `4xx` responses — those mean the request was wrong, so retrying just replays a request that will fail again. Retry `5xx`, timeouts, and connection errors only.
