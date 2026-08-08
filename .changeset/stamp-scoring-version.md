---
"prosemeter": patch
---

The CLI's human-readable score header now names the engine that produced the number:
`draft.md 90/100 (profile: plain, prosemeter 0.4.2)`. Dimension defaults move between releases and
the scores move with them, so a number quoted without a version cannot be checked against a later
one. The `--json` output has carried `version` since the field existed; this puts it on the human
path too. No score, verdict, or JSON byte changes.
