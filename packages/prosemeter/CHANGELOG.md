# prosemeter

## 0.2.0

### Minor Changes

- 000a2e8: Convergence: add a `regressing` verdict and dimension-churn detection.

  `checkConvergence` now returns `regressing` for a sustained decline (≥2 significant, all-negative deltas in the window) instead of folding it into `plateaued`. The loop contract is unchanged — revise while `improving`, stop on anything else — but the stop _reason_ is now honest, so a harness can attach policy (on `regressing`, prefer reverting to the highest-scoring prior draft over continuing from the latest).

  New `checkConvergenceDetailed(history, dimensions, options)` returns `{ verdict, churning }`, where `churning` lists dimensions that oscillate or regress under a flat composite — the signature of an agent trading one dimension for another rather than converging. New `DimensionHistory` and `ConvergenceReport` types.

  The `check_convergence` MCP tool gains an optional `dimensions` parameter and now returns `{ verdict, churning, detail }` (previously `{ verdict, detail }`).

  **Behavior change — read before upgrading:** score histories that previously classified as `plateaued` for a sustained decline now classify as `regressing`. If you branch on the string `plateaued` to auto-accept or ship a draft, add a `regressing` case first — you do not want a regression to inherit accept-on-plateau behavior. TypeScript consumers with an exhaustive `switch` on `ConvergenceVerdict` will need the new case. The MCP tool's return shape changed from a bare `{ verdict, detail }` to `{ verdict, churning, detail }`; clients that read `.verdict` are unaffected.

### Patch Changes

- Updated dependencies [000a2e8]
  - @prosemeter/core@0.2.0
  - @prosemeter/readability@0.2.0
  - @prosemeter/structure@0.2.0
  - @prosemeter/style@0.2.0
  - @prosemeter/vocabulary@0.2.0
