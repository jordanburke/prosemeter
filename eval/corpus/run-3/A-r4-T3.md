---
kind: eval-artifact
run: 3
variant: A
replicate: r4
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The bug is that your retry is treating a failed *response* as a failed *operation*, and those aren't the same thing.

Here's the sequence that charges twice:

1. You POST the charge to the processor.
2. The processor receives it, charges the card, and starts writing the response.
3. The connection times out / the load balancer kills it / the pod restarts.
4. Your client sees an error and retries.
5. The processor receives what looks like a brand-new charge request and charges the card again.

From your side, step 3 is indistinguishable from "the request never arrived." From the processor's side, nothing went wrong at all. That ambiguity is unavoidable — no amount of client-side cleverness tells you which half of the round trip failed. This is why "retry on timeout" is safe for a GET and dangerous for a POST.

**Idempotency is the fix**, and it means: performing the operation N times has the same effect as performing it once. Reads are naturally idempotent. `SET balance = 100` is idempotent. `charge $50` is not — that's the whole problem.

You make it idempotent by attaching a client-generated key to the request. Something like:

```
POST /charges
Idempotency-Key: 7f3a9c21-... (a UUID your code generates)
{ "amount": 5000, "currency": "usd", ... }
```

The server stores that key with the result of the operation. On a repeat request with the same key, it doesn't re-execute — it looks up the stored result and returns it. So the retry in step 4 gets back the *original* charge's response, and the card is hit exactly once.

Two details that people get wrong:

**Generate the key at the point where the intent originates, not inside the retry loop.** If you mint a fresh UUID per attempt, every retry looks like a new operation and you've built exactly nothing. The key should be created once, when the user clicks "Pay," and reused for every attempt of that logical charge. Deriving it from something stable — the cart/order ID — is often better than a random UUID, because it survives a process crash and restart.

**Check whether your processor already supports this.** Stripe, Adyen, and most modern payment APIs have an `Idempotency-Key` header built in and will do the right thing. You may not need to build anything — you may just need to start sending the header. That's the first thing I'd check.

If you're the one implementing the server side, the storage of the key has to be in the same transaction as the effect, or you get a smaller version of the same race: the charge commits, the key write fails, the retry charges again.

And regardless of the above: bound your retries, use exponential backoff with jitter, and don't retry 4xx responses. A `400` will be a `400` forever, and retrying it just adds load while your card is already declined.
