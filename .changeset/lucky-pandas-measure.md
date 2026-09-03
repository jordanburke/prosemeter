---
"@prosemeter/core": minor
"@prosemeter/readability": minor
---

`grade-band` now pools SMOG, Gunning Fog and Flesch-Kincaid instead of taking the median of all
five formulas. **Scores change for every document.**

Measured against 4,724 human-rated CLEAR corpus excerpts, the median correlated −0.528 with human
reading ease. This mean reaches −0.560, because Coleman-Liau (−0.479) and ARI (−0.497) are the
weakest two and a median lets them pull the result down. Williams' test on the dependent
correlations gives t = −14.09, so the improvement is not sampling noise. The composite's explained
variance roughly doubles, from 5.4% to 10.4%, and `sentence-simplicity` — which shares the same
pooled statistic per sentence — improves slightly, from 0.486 to 0.493.

SMOG alone correlates better still (−0.575) and is deliberately not used on its own. Its constant
floors it near grade 3.1, so it cannot express how extreme telegraphic prose is: on SMOG alone
`choppy-simplistic.md` scored exactly at the `chat` threshold rather than below it. Flesch-Kincaid
and Gunning Fog supply the low-end sensitivity that guard rail needs. Two tests now pin this.

Coleman-Liau and ARI are still computed and still reported in the finding detail. They are only
excluded from the pool.

**Breaking for direct consumers of `@prosemeter/readability`:** `GradeBreakdown.median` is renamed
to `GradeBreakdown.pooledGrade`, because it is no longer a median. The `grade-band` finding detail
now reads `pooled grade 10.0 vs band 8–12` where it previously read `median grade 10.0 vs band
8–12`, so anything parsing that string needs updating.

Band edges are unchanged. The pooled grade distribution shifts by 0.05 grades across the corpus, so
no profile needed retuning, and all seven profiles keep their existing bands.

See `eval/LIB_RPT_clear-corpus-validation_2026-08-29.md`.
