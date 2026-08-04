---
"@prosemeter/readability": patch
---

grade-band: add an optional `direction` to enforce one side of the band

`dimensionOptions: { "grade-band": { direction: "floor" | "ceiling" } }` scores only
the simplistic or only the hard side; the unenforced side scores 1 at any distance.
Default stays `both`, and no built-in profile sets it.

It is for callers scoring a pre-filtered corpus, where one side can never fire. The
built-in profiles keep both sides: measured against the calibration fixtures,
floor-only lets a document at median reading grade 25.8 score a perfect 100 and
collapses the chat register spread from 44 points to 21.
