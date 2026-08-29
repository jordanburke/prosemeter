---
"@prosemeter/core": patch
---

Update runtime dependencies: `functype` 1.8.0 to 1.9.0 across `core`,
`readability`, `structure`, `style`, `vocabulary`, and `prosemeter`, and
`somamcp` 1.1.2 to 1.3.0 in `@prosemeter/mcp`.

Both are dependencies rather than devDependencies, so the ranges consumers
install change. No prosemeter API changes, and no scoring changes — the
readability snapshots that pin whole-document scores are unmoved.
