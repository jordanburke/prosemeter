---
"prosemeter": patch
"@prosemeter/core": patch
"@prosemeter/mcp": patch
---

Describe `thresholdDefault` as the floor it is, and say why the loop converged

Measured, never asserted before: **no single dimension can fail a threshold on any
profile.** Zero the heaviest-weighted dimension on an otherwise perfect document
and the composite still lands at 76.9–81.8, above every threshold (68–75). A
threshold is only failed when several dimensions fail together.

The fixtures agree. `passive-heavy.md`, built to demonstrate one flaw, scores 95
on `plain` and 98 on `api-docs`; its `active-voice` sits at 38 but weight 0.08
caps the damage at 4.9 points. Five of nine fixtures clear `plain`'s 70. The only
fixture that fails exactly one profile is `choppy-simplistic.md` on `chat`, whose
grade-band weight of 0.24 is the anti-gaming counterweight — profile tuning is
what makes a threshold bite, not the number.

No threshold changed. Three descriptions did:

- The MCP `check_convergence` tool said "Target score; reaching it yields
  'converged'". It now says floor, and that reaching it means "not catastrophic"
  rather than "done".
- `prosemeter profiles` said "suggested threshold"; it now says "floor".
- `packages/core/src/profiles.ts` carries the measurement and a warning not to
  calibrate against `fixtures/`, which are handcrafted to isolate single
  dimensions and so are useless as a calibration set.

The CLI also now says *why* it converged when the floor is what stopped it:

    Convergence: converged   (history: 90)  — 90 ≥ floor 70; pass --threshold to change

`checkConvergence` treats clearing the threshold as a stop regardless of
trajectory, and the CLI supplies the profile's floor when the caller passes none,
so a first pass on a competent draft converges immediately. Printing the verdict
alone made that look like a bug rather than a floor being cleared. Behaviour is
unchanged; only the explanation is new.

Full measurement in docs/LIB_ANLY_threshold-semantics_2026-08-07.md.
