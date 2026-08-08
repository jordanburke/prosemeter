---
kind: eval-artifact
run: 4
variant: E
replicate: r1
task: T3
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry fired on requests that had already succeeded. The charge went through, the response got lost on the way back, and your client saw a timeout and tried again.

A timeout tells you nothing about what happened on the server. The request may have never arrived. It may have arrived and failed. Or it may have arrived, charged the card, and then died returning the response. Your client can't tell those apart, so a blind retry gambles that the third case never happens. At scale it always happens.

Idempotency closes the gap. An idempotent operation produces the same result whether you run it once or five times. Payment APIs get there with an **idempotency key**: the client generates a unique key per logical charge and sends it with every attempt. The server stores the key with the result. If a request arrives with a key it has seen, the server skips the work and replays the stored response.

So the retry becomes safe. The second attempt hits the stored key, gets back the original charge, and no second charge happens.

To fix yours:

- **Generate the key before the first attempt**, not inside the retry loop. A fresh UUID per attempt defeats the whole thing.
- **Tie the key to the intent**, meaning one key per checkout, not one per user or per day.
- **Persist the key with the charge in one transaction**, so a crash between the two can't lose the record.
- **Return the stored response on replay**, including the original charge ID. Don't return a 409 and make callers guess.
- **Only retry what's safe.** Retry on timeouts, 429s, and 5xx. Never retry a 4xx, because the server understood you and said no.
- **Back off with jitter**, so a blip doesn't turn your whole fleet into a retry storm.

Most payment providers already support this — Stripe takes an `Idempotency-Key` header. Check whether yours does before building it yourself.

Then go find the duplicate charges from today and refund them.
