/**
 * The research collection reads `eval/`'s reports in place, outside `site/`.
 *
 * Deliberately not copied in. A report is the record of a run, and a second copy would drift from
 * the one the repo treats as authoritative the first time either is edited. The `base` option lets
 * the loader reach up out of `site/`, so the file the site renders is the file the eval harness
 * wrote.
 */

import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const research = defineCollection({
  loader: glob({ pattern: "LIB_RPT_*.md", base: "../eval" }),
  schema: z.object({
    slug: z.string(),
    run: z.string(),
    date: z.string(),
    title: z.string(),
    /**
     * The headline result, in one sentence — what the index page shows.
     *
     * **No measured figures.** Say what was found; the page computes how much, from
     * `eval/results/*.json`. This is not style: the first version of these lines was hand-written,
     * and one said a run "cut jargon 2.0 points" on a page that computed 2.1 from the same data. The
     * 2.0 came from subtracting already-rounded values. A page arguing that prose should be measured
     * cannot contradict itself in two places on one screen, so the schema refuses the class of
     * mistake rather than trusting the author to avoid it.
     */
    finding: z
      .string()
      .refine((s) => !/\d+(\.\d+)?\s*(%|points?)\b/i.test(s), {
        message: "finding must not quote a measured figure — the page computes those from eval/results",
      }),
    order: z.number(),
  }),
})

export const collections = { research }
