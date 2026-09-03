---
"@prosemeter/core": patch
---

Re-release of 0.5.0. No code changes.

`@prosemeter/style@0.5.0` reached npm in a staged state — its version metadata
published but its tarball did not, so `registry.npmjs.org/@prosemeter/style/0.5.0`
returned 200 while `style-0.5.0.tgz` returned 404. The other six packages
published cleanly, which left `prosemeter@0.5.0` as `latest` and uninstallable:
it requires `@prosemeter/style@^0.5.0`, and the only version satisfying that had
no tarball.

The publish workflow exited 0 and listed all seven packages as published, so
nothing failed loudly. Re-running surfaced the real state:

    E409: Cannot publish over previously staged version "0.5.0"

npm will not let a staged version be rewritten, so `@prosemeter/style@0.5.0` is
permanently unusable and 0.5.0 cannot be repaired in place. 0.5.1 is the same
tree published into version slots that are actually free.

Everything described in 0.5.0's entry ships here: `grade-band` pools SMOG,
Gunning Fog and Flesch-Kincaid rather than the median of all five,
`GradeBreakdown.median` is renamed to `GradeBreakdown.pooledGrade`, and the
finding detail reads "pooled grade" where it read "median grade". Read that
entry for the measurements behind the change.

**Do not install 0.5.0.** Use 0.5.1 or later.
