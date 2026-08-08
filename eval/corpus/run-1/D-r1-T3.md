---
kind: eval-artifact
run: 1
variant: D
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
The bug isn't really in your retry logic — it's that your retry logic assumes "I didn't get a response" means "it didn't happen." Those are different things, and payments is exactly where that difference costs money.

Picture the wire. You send `POST /charges`. The request reaches the processor, the card is charged, the processor writes the response... and then the connection drops, or the load balancer times out at 30s, or your client's timeout is 10s and the processor took 12. From your side all of those look identical: no response. But the charge happened. You retry, the charge happens again, and the customer sees two.

The general shape: **a network failure tells you nothing about whether the server did the work.** You only ever learn about the *response*, not the action. Timeouts and connection resets sit in a genuinely ambiguous state, and a naive retry resolves that ambiguity by guessing "no."

That's where idempotency comes in. An operation is idempotent if doing it twice has the same effect as doing it once. `DELETE /users/42` is naturally idempotent — the second call finds nothing to delete and the end state is the same. "Charge this card $50" is naturally *not*, because the effect is a delta, not a state assertion. So you have to add idempotency artificially, and the standard way is an **idempotency key**.

How it works:

1. Your client generates a unique key (a UUID is fine) **before the first attempt**, and ties it to the logical operation — one key per "user clicked Pay on order 1234."
2. You send it with the request, usually as an `Idempotency-Key` header.
3. The server, before doing any work, tries to insert that key into a table with a unique constraint. If the insert succeeds, it's a new operation: do the charge, store the result against the key. If the insert conflicts, it's a replay: return the stored result without charging again.
4. Every retry of that operation reuses **the same key**.

That last point is where people get it wrong. If you generate the key inside the retry loop, each attempt gets a fresh key and the server sees three unrelated charges. The key has to be created once, at the point where the *user's intent* is created, and carried through every attempt. I'd derive it from something stable — the order ID plus attempt-of-intent — rather than calling `uuid()` somewhere in the HTTP layer.

A few things that bite people once they've got the basic version working:

- **The in-flight case.** Two retries can overlap: attempt 1 is still processing when attempt 2 arrives. If your check is "SELECT then INSERT" you'll race and charge twice. Rely on the unique constraint doing the work — insert first, let the database reject the duplicate — and have the loser either wait for the original or return `409`.
- **Store the response, not just the key.** The whole point is that a retry gets the *same answer*, including the charge ID. If you just record "seen this key" and return `200 OK` with no body, the caller can't reconcile.
- **Failures need to be recorded too**, or at least deliberately not recorded. Decide whether a declined card under key K should be replayable-as-declined, or whether the key should be released so the user can try again. Both are defensible; pick one on purpose.
- **Keys need a TTL**, and it should be longer than your longest retry window. Stripe uses 24 hours. Don't expire them in five minutes.
- **Don't retry everything.** Retry on timeouts, connection errors, 429, and 5xx. A `400` means your request was wrong and retrying it just wastes calls. And use exponential backoff with jitter, otherwise a blip turns into a thundering-herd retry storm against a processor that's already unhappy.

If your processor is Stripe or Adyen or similar, they already support idempotency keys and you should turn them on rather than build your own layer — but you still need to fix the key-generation-inside-the-loop problem on your side, because their support doesn't help if you send a different key each time.
