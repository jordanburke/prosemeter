/**
 * The demo documents, read straight from the repo's `fixtures/` directory.
 *
 * They are never copied into the site. `fixtures/` is the same corpus the snapshot tests and the
 * `chat` profile calibration run against, so a document that changes there changes here too, and
 * the site cannot drift from the engine's own test data.
 */

const raw = import.meta.glob("../../../fixtures/*.{md,txt}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

export type Fixture = {
  readonly id: string
  readonly label: string
  readonly profile: string
  readonly format: "markdown" | "plaintext"
  /**
   * What this document demonstrates. **Never put a score in here.** Every number on the site is
   * computed at build time or in the browser; a hand-written one goes stale the next time a
   * dimension's defaults move, which has happened twice.
   */
  readonly blurb: string
}

const META: Record<string, Omit<Fixture, "id">> = {
  "chat-jargon": {
    label: "Jargon",
    profile: "chat",
    format: "markdown",
    blurb: "A correct answer nobody wants to read. Every idea is right; the register buries all of them.",
  },
  "chat-clear": {
    label: "Plain",
    profile: "chat",
    format: "markdown",
    blurb: "The same answer to the same question, with the same fix. Only the register changed.",
  },
  "choppy-simplistic": {
    label: "The gamed rewrite",
    profile: "chat",
    format: "markdown",
    blurb:
      "Chops every sentence to buy the readability formulas. Perfect on simplicity, clarity, and concision — and it still fails.",
  },
  "dense-academic": {
    label: "Dense academic",
    profile: "plain",
    format: "markdown",
    // Checked, and it does *not* do the obvious thing: this reads so far above the band that
    // `academic` cannot save it, and switching there also drops the passive-voice check it was
    // passing, so the composite falls rather than rises. Worth showing precisely because it is
    // counter-intuitive.
    blurb:
      "Too dense for every band, `academic` included. Switching there also drops the passive-voice check it was passing, which lowers the score rather than raising it.",
  },
  "wall-of-text": {
    label: "Wall of text",
    profile: "readme",
    format: "markdown",
    blurb: "One unbroken paragraph. Structure is a dimension, not a preference.",
  },
  "passive-heavy": {
    label: "Passive voice",
    profile: "readme",
    format: "markdown",
    blurb: "Try it on `api-docs` too, where passive voice is tolerated. The profile decides what counts.",
  },
  "mixed-spelling": {
    label: "Inconsistent terms",
    profile: "readme",
    format: "markdown",
    blurb: "organize/organise, color/colour. Neither is wrong; using both in one document is.",
  },
  "good-readme": {
    label: "A passing README",
    profile: "readme",
    format: "markdown",
    blurb: "What clearing the bar looks like. Note how few findings remain, and that some still do.",
  },
  "plaintext-sample": {
    label: "Plain text",
    profile: "plain",
    format: "plaintext",
    blurb: "Not everything is markdown. Structure dimensions skip themselves rather than punish it.",
  },
}

/** Presentation order. The first entry is what the page loads. */
const ORDER = [
  "chat-jargon",
  "chat-clear",
  "choppy-simplistic",
  "good-readme",
  "wall-of-text",
  "passive-heavy",
  "dense-academic",
  "mixed-spelling",
  "plaintext-sample",
] as const

const byId = new Map<string, string>(
  Object.entries(raw).map(([path, text]) => [path.replace(/^.*\/(.+)\.(md|txt)$/, "$1"), text]),
)

export const fixtures: ReadonlyArray<Fixture & { readonly text: string }> = ORDER.flatMap((id) => {
  const text = byId.get(id)
  const meta = META[id]
  if (text === undefined || meta === undefined) return []
  return [{ id, ...meta, text }]
})

export const DEFAULT_FIXTURE = "chat-jargon"

/**
 * The two halves of the register comparison, in toggle order. Same question, same fix, same code
 * block — the only variable is how it is written.
 */
export const REGISTER_PAIR = ["chat-jargon", "chat-clear"] as const
