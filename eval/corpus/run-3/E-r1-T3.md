---
kind: eval-artifact
run: 3
variant: E
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired on a request that had already succeeded. The charge went through, the response got lost on the way back, and your client saw a timeout and tried again.

This is the core problem: a failed response does not mean a failed request. When you get a timeout, a 502, or a dropped connection, you know nothing about what happened on the server. The charge may have been created, or not. Your retry logic assumed "no response" meant "nothing happened," and that assumption is wrong roughly whenever the failure happens on the return trip.

Idempotency is the property that doing something twice has the same effect as doing it once. `DELETE /users/5` is naturally idempotent — the user is gone either way. Creating a charge is not, because two calls mean two charges. So you have to add the property by hand.

You do that with an **idempotency key**. The client makes up a unique key per logical operation — a UUID generated once, before the first attempt — and sends it on every attempt of that operation. The server stores the key with the result of the first request. When a request arrives with a key it has seen, the server skips the work and replays the stored response.

The parts people get wrong:

- **Generate the key before the first try, not per attempt.** A fresh UUID on each retry defeats the whole thing. Same logical charge, same key, forever.
- **Store the key in the same transaction that creates the charge.** If you write the charge and then write the key, a crash between them leaves you unprotected. A unique constraint on the key column gives you this for free.
- **Handle the in-flight case.** The retry can arrive while the first request is still running. Return a 409 and let the client back off, rather than letting both run.
- **Replay the original response.** Returning a bare 200 with no body makes the client think it created something new.

Stripe, Square, and Adyen all support `Idempotency-Key` as a header. If you are calling one of them, you already have the mechanism — you just are not sending the key. Check that first.

Then fix the retry policy separately: only retry on timeouts, 429s, and 5xx, use exponential backoff with jitter, and cap the attempts. Retrying a 400 forever just generates load.
