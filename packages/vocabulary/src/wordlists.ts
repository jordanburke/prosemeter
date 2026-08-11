/** Seed data for the vocabulary dimensions: a common-acronym allowlist and US/UK spelling pairs. */

/**
 * ALL-CAPS words that are keywords or verbs rather than acronyms.
 *
 * `acronym-definition` matches `/^[A-Z]{2,}s?$/`, which cannot distinguish an initialism from an
 * ordinary English word someone typed in caps. That made SQL keywords and HTTP verbs read as
 * undefined acronyms: measured over 604 corpus documents, `GET` was flagged 77 times, `INSERT` 24,
 * `UPDATE` 23, `DELETE` 22, `SELECT` 4 — none of which has an expansion to write.
 *
 * These are closed sets, so enumerating them is calibration rather than whack-a-mole. Genuine
 * acronyms the same sweep surfaced — `UUID`, `TTL`, `CDN`, `WAL`, `ORM`, `DOM`, `OLTP` — are
 * deliberately **not** here. Those have expansions, and a reader who does not know them is stuck,
 * which is the case the rule exists for.
 */
const CAPS_KEYWORDS: ReadonlyArray<string> = [
  // HTTP verbs
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "HEAD",
  "OPTIONS",
  "TRACE",
  "CONNECT",
  // SQL
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "WHERE",
  "FROM",
  "JOIN",
  "GROUP",
  "ORDER",
  "LIMIT",
  "OFFSET",
  "VALUES",
  "INTO",
  "TABLE",
  "INDEX",
  "NULL",
  "AND",
  "OR",
  "NOT",
  "ALL",
  "ANY",
  "ON",
  "AS",
  "IF",
  "IS",
  "IN",
  "TO",
  "BY",
  // Log levels. All-caps English words lifted out of log output, not initialisms — the corpus
  // surfaced `FATAL` from a Postgres line pasted into a diagnosis answer.
  "FATAL",
  "DEBUG",
  "INFO",
  "WARN",
  "WARNING",
  "ERROR",
  "PANIC",
  "NOTICE",
]

/**
 * Technical shorthand an engineering reader does not need expanded.
 *
 * Separate from `CAPS_KEYWORDS` because these *are* abbreviations — they simply do not carry a
 * comprehension cost for the audience these profiles target. Corpus counts: `JSX` 23, `DB` 17,
 * `PR` 12, `JS` 4.
 */
const TECH_SHORTHAND: ReadonlyArray<string> = ["JS", "TS", "JSX", "TSX", "DB", "PR", "OS", "VM", "K8S", "ENV", "REPL"]

/** Acronyms so common they need no definition. Extendable per profile via `options.allowlist`. */
export const ACRONYM_ALLOWLIST: ReadonlyArray<string> = [
  ...CAPS_KEYWORDS,
  ...TECH_SHORTHAND,
  "API",
  "URL",
  "URI",
  "HTTP",
  "HTTPS",
  "JSON",
  "YAML",
  "XML",
  "HTML",
  "CSS",
  "SQL",
  "REST",
  "CLI",
  "GUI",
  "ID",
  "OK",
  "FAQ",
  "PDF",
  "CSV",
  "UI",
  "UX",
  "IDE",
  "NPM",
  "CPU",
  "GPU",
  "RAM",
  "OS",
  "IO",
  "TLS",
  "SSL",
  "DNS",
  "IP",
  "TCP",
  "UDP",
  "SDK",
  "CI",
  "CD",
  "AI",
  "ML",
  "LLM",
  "MCP",
  "USB",
  "PDF",
  "URL",
  "ISO",
  "UTC",
  "USA",
  "UK",
  "EU",
  "FYI",
  "ASAP",
  "AKA",
  "ETC",
  "MIT",
  "GPL",
  "BSD",
  "LTS",
  "GNU",
  // Common all-caps words that are not acronyms.
  "README",
  "TODO",
  "FIXME",
  "NOTE",
  "WARNING",
]

/** US/UK spelling pairs, `[usForm, ukForm]`, lower-cased. */
export const US_UK_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["color", "colour"],
  ["honor", "honour"],
  ["favor", "favour"],
  ["flavor", "flavour"],
  ["humor", "humour"],
  ["labor", "labour"],
  ["neighbor", "neighbour"],
  ["behavior", "behaviour"],
  ["center", "centre"],
  ["meter", "metre"],
  ["theater", "theatre"],
  ["liter", "litre"],
  ["fiber", "fibre"],
  ["organize", "organise"],
  ["recognize", "recognise"],
  ["analyze", "analyse"],
  ["apologize", "apologise"],
  ["catalog", "catalogue"],
  ["dialog", "dialogue"],
  ["defense", "defence"],
  ["offense", "offence"],
  ["gray", "grey"],
  ["traveled", "travelled"],
  ["canceled", "cancelled"],
  ["modeling", "modelling"],
  ["labeled", "labelled"],
  ["fulfill", "fulfil"],
  ["enroll", "enrol"],
  ["skillful", "skilful"],
  ["jewelry", "jewellery"],
  ["aluminum", "aluminium"],
  ["judgment", "judgement"],
  ["acknowledgment", "acknowledgement"],
  ["initialize", "initialise"],
  ["customize", "customise"],
  ["optimize", "optimise"],
]
