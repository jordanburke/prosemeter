---
kind: eval-artifact
run: 5
variant: F
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## Why did my retry logic cause duplicate charges?

Your retry fired after a charge that had already succeeded. The first request reached the payment provider and moved the money. The response back to you was lost — a timeout, a dropped connection, a load balancer that gave up. Your code saw no answer, assumed failure, and sent the charge again.

The provider had no way to tell the second request apart from a genuine second purchase. It looked identical to a customer buying the same thing twice. So it charged twice.

This is the core problem with any network call: a timeout does not tell you whether the work happened. It tells you that you did not hear back. Those are different facts, and only one of them is safe to retry on.

## What does idempotency have to do with it?

Idempotency is the property that doing something twice has the same effect as doing it once. It is what makes a retry safe.

Reads are idempotent for free. Fetching a balance five times leaves the balance where it was. Charging a card is not — each call moves money.

You make a non-idempotent operation idempotent by giving it a name the server can recognize. Generate a unique key before the first attempt and send it with every attempt of that same charge. The server stores the key alongside the result. When a request arrives with a key it has seen, it skips the work and returns the stored result. The retry gets the original charge back instead of making a new one.

Every serious payment provider supports this. Stripe reads an `Idempotency-Key` header. Adyen and Square use a reference field on the request body. Check yours — the feature is almost certainly there and unused.

## How do I fix it?

Generate the key once, at the point where the user decides to pay.

That timing is the part people get wrong. If you generate the key inside the retry loop, every attempt carries a fresh key, and the server sees each as a new charge. The key has to come from outside the loop and stay fixed across all attempts. A UUID stored with the order works. So does a hash of the order ID and the amount.

Keep the key tied to the request contents. If someone reuses a key with a different amount, the server should reject it rather than silently return the old result. Providers usually enforce this for you.

Retry only what is worth retrying. A 500 or a timeout may have succeeded, so retry with the same key. A 400 means the request was malformed, and sending it again just repeats the mistake. Back off between attempts and cap the total.

Clean up the charges you already made. Search the provider's dashboard for charges on the same customer, same amount, within a few seconds of each other. Refund the extras before a customer finds them.
