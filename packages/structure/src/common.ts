/** Shared helpers for the structure dimensions: the plaintext skip guard and option reading. */

import type { DimensionId, DimensionResult } from "@prosemeter/core"
import type { Finding } from "@prosemeter/core"
import { None, Some } from "functype"

export const PLAINTEXT_SKIP = "structure not meaningful for plaintext"

export const skipped = (id: DimensionId, weight: number, reason: string): DimensionResult => ({
  id,
  score: 0,
  weight,
  detail: `skipped: ${reason}`,
  findings: [],
  skipped: Some(reason),
})

export const numberOption = (options: Readonly<Record<string, unknown>>, key: string, fallback: number): number => {
  const value = options[key]
  return typeof value === "number" ? value : fallback
}

/** A finding anchored to a source line (column/offset unknown — heading-level signals). */
export const lineFinding = (
  dimension: DimensionId,
  rule: string,
  severity: Finding["severity"],
  message: string,
  hint: string,
  line: number,
  excerpt: string,
): Finding => ({
  rule,
  dimension,
  severity,
  message,
  hint,
  loc: line > 0 ? Some({ line, column: 1, offset: 0, length: 0 }) : None(),
  excerpt,
})
