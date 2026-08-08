---
kind: eval-artifact
run: 5
variant: E
replicate: r5
task: T3
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your retry charged twice because the first charge succeeded and you never found out. Idempotency is how you retry safely without a second charge.

## What happened

A network call has three outcomes, not two. It can succeed, it can fail, and it can fail to tell you which.

A timeout is the third case. Your request reached the payment provider, the provider charged the card, and the response died on the way back. Your client saw nothing, decided the call had failed, and sent it again. The provider saw a second, entirely new charge request and did the obvious thing.

The same happens with a 502 from a proxy, with a dropped connection, and with a client-side deadline that fires while the server is still working. In all of them the work happened and the answer did not come back.

## Why retrying is still right

You cannot fix this by dropping the retry. Real networks lose responses, and a payment that silently never happened is worse than a duplicate. The fix is to make the second attempt land on the same charge instead of a new one.

## What idempotency means here

An operation is idempotent when doing it twice leaves the same result as doing it once. Reads are naturally idempotent. Charging a card is not, so you have to build it.

You build it with an **idempotency key**: a unique value your client generates for one logical payment, sent with every attempt at that payment.

The server keeps a record keyed by that value.

- First request with the key: do the work, store the key with the result, return it.
- Later request with the same key: skip the work, return the stored result.

The retry now returns the original charge instead of creating a second one. Stripe, Adyen, and most providers accept this as an `Idempotency-Key` header — read your provider's docs for the exact name and retention window.

## Getting the key right

**Generate the key once, at the top.** The key must belong to the intent to pay, not to the HTTP attempt. If you mint a fresh UUID inside the retry loop, every attempt gets a new key and you are back where you started.

**Derive it from something stable.** An order ID, or a UUID created when the user hits Pay, and store it alongside the order. If your service also crashes and restarts, the key must survive that.

**Scope it.** The key identifies one payment, not one customer and not one session.

## The same rule applies to your own database

The provider is only half of it. If your handler charges the card and then writes a payment row, a retry can duplicate the row even when the charge was deduplicated correctly.

Put a unique constraint on the idempotency key in your own table and let the database reject the second write. A constraint holds under concurrency; a check-then-insert does not, because two requests can both pass the check before either inserts.

## What to do now

Add keys to the charge path first, then to refunds and transfers. Then find the existing duplicates by grouping charges by customer, amount, and a short time window, and refund them before your customers find them for you.
