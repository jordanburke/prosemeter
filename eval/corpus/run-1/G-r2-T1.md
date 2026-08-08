---
kind: eval-artifact
run: 1
variant: G
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "Offers 'picks one version and breaks the other' as a branch; the resolver installs both."
---
Your build broke because two packages now ask for different versions of the same library, and the resolver can't give both what they want.

Here's the shape of it. Your package depends on `lib@^2`. The new package depends on `lib@^3`. The package manager either picks one version and breaks the other, or installs both and you end up with two copies in the tree. Two copies is the nastier case: types stop matching, `instanceof` checks fail, and singletons like a config store or a React context get duplicated. The error usually looks like a type mismatch on something that is obviously the right type.

Find out which case you have first:

```bash
pnpm why <library-name>
```

That prints every path that pulls the library in, and the version each one asked for.

Then pick a fix, roughly in this order:

1. **Bump the lagging package.** If your `^2` can move to `^3` without much work, do that. One version in the tree, problem gone. This is the real fix.
2. **Ask the other team to widen their range.** If they can support `^2 || ^3`, that costs them a line and fixes it for everyone.
3. **Force one version with an override.** In the root `package.json`:

   ```json
   {
     "pnpm": {
       "overrides": {
         "<library-name>": "3.1.0"
       }
     }
   }
   ```

   This works, but you are telling the resolver to ignore what a package asked for. Only do it when you've checked the API the older consumer uses still exists in the new version. Leave a comment saying why.

Avoid the fourth option, which is deleting the lockfile and hoping. That hides the conflict until it shows up in prod.

One more thing worth checking: if the library is meant to be a singleton, it may belong in `peerDependencies` rather than `dependencies`. That makes the host app own the version and turns silent duplication into a loud install warning.
