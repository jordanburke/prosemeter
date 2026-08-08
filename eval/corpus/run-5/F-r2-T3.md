---
kind: eval-artifact
run: 5
variant: F
replicate: r2
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did my retries create duplicate charges?

Your retries fired after the charge had already succeeded.

A failed request is not the same as a failed operation. The payment processor took your request, charged the card, and then something broke on the way back — a timeout, a dropped connection, a load balancer giving up. Your code saw no response, assumed nothing happened, and sent the request again. The processor had no way to tell the second request from a genuine second purchase, so it charged the card twice.

This gap is unavoidable. Any network call has a window where you cannot tell "it never ran" from "it ran and the answer got lost". Retrying inside that window is what turns one intent into two charges.

## What does idempotency have to do with it?

Idempotency means doing the operation twice has the same effect as doing it once. That property is what makes a retry safe.

Card charges are not naturally idempotent, so you have to add the property. You do it with an **idempotency key** — a unique string you generate for one logical payment and send with every attempt at it.

The processor uses the key like this. On the first request with a given key, it charges the card and stores the result against that key. On any later request with the same key, it skips the charge and replays the stored result. Your retry gets back the original success response, and the customer is charged once.

## How do I fix this?

Send an idempotency key with every payment request, and generate it in the right place.

Generate the key once per payment intent, before the first attempt, and reuse it across all retries of that attempt. Generating a fresh key inside the retry loop defeats the whole mechanism, because each attempt then looks like a new payment. A UUID works; so does a hash of the order id plus the amount.

Store the key with the order in your own database, before you call the processor. If your service crashes mid-payment and restarts, it can then look up the key and retry the same one rather than inventing a new payment.

Stripe, Adyen, and Braintree all support this — Stripe takes it as an `Idempotency-Key` header. Check how long your processor keeps keys, because most expire them after about 24 hours, after which the same key charges again.

Two more habits worth keeping:

- **Only retry what is safe to retry.** Retry on timeouts, connection errors, and 5xx responses. Do not retry a 4xx — the request was rejected on its own terms, and sending it again will fail the same way.
- **Back off between attempts.** Wait longer after each failure, with a little randomness added, so a struggling processor is not hit by every client at once.
