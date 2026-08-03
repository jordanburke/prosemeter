---
"@prosemeter/style": patch
---

Stop `directness` flagging modal verbs and ordinary verbs.

`retext-intensify`'s weasel list carries modal verbs (`can`, `will`, `should`, `must`, `would`) and
plain verbs (`read`, `find`) alongside genuine hedges. In technical advice the modals state
capability, prediction, recommendation, and obligation precisely — "you can drop it", "it will
fail", "the key must stay stable". `may`, `might` and `could` stay flagged, because those do hedge.

Also ignored: `exactly`, `already`, `right`, `real`, `too`, `much`, `about`, which are precise in
technical prose ("exactly one version", "the right index", "already hoisted").

Measured over 244 answers and fixtures: flags drop from 3305 to 2080. The calibration fixtures
separate cleanly (clear 100, jargon 49), and the dimension becomes a usable instruction signal —
its variance ratio (spread across tasks over spread across writing styles) falls to 1.1, second
only to word count. Before the fix it could not tell the shipped instruction from no instruction
at all.

Scores on this dimension rise for most documents, which moves the composite slightly.
