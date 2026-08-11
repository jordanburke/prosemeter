---
"@prosemeter/vocabulary": patch
---

`terminology-consistency` and `acronym-definition` no longer treat ALL-CAPS as a signal it is not

Both rules read an all-capital word as something it isn't, and both produced their worst false
positives that way.

**`terminology-consistency`** decided a term had "meaningful casing" via
`/[A-Z]/.test(word.slice(1))`, which is true of every ALL-CAPS word. So `INSERT` counted as a brand
like `GitHub`, and the rule flagged it as an inconsistent spelling of the verb `insert`. Measured
over 604 documents, every sampled finding was this shape — INSERT/insert, DELETE/delete,
UPDATE/Update. A form now qualifies only when it has an internal capital *and* is not entirely
uppercase, with a trailing plural stripped first so `UPDATEs` does not slip through.

**`acronym-definition`** matches `/^[A-Z]{2,}s?$/`, which cannot separate an initialism from a
keyword. SQL verbs, HTTP methods and log levels were reported as undefined acronyms: `GET` 77 times
across the corpus, `INSERT` 24, `UPDATE` 23, `DELETE` 22. None has an expansion to write. Those
closed sets are now allowlisted, along with technical shorthand an engineering reader does not need
expanded (`JS`, `DB`, `PR`, `JSX`). Genuine acronyms are deliberately untouched — `UUID`, `TTL`,
`CDN`, `WAL`, `ORM`, `DOM` and friends still flag, because a reader who does not know them is stuck.

Corpus effect: terminology findings 147 → 2, acronym findings 705 → 489. The two surviving
terminology findings are both from `fixtures/mixed-spelling.md`, the fixture written to exercise the
rule.

**Scores rise for affected documents**, since both dimensions score on finding density. No
calibration fixture moves at all, which is why the suite never caught this — the fixtures do not
contain the failure mode.
