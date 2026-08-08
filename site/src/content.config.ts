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
    /** The headline result, in one sentence. This is what the index page shows. */
    finding: z.string(),
    order: z.number(),
  }),
})

export const collections = { research }
