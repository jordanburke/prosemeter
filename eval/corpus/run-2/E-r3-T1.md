---
kind: eval-artifact
run: 2
variant: E
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and only one version can win at a given spot in the tree.

Here is the mechanism. The new package declares a version range that does not overlap with the one your package already used. The package manager either hoists one version to the top and leaves the other nested, or it refuses to pick and errors out. When it hoists, your code and the new code can end up holding two separate copies of the library. Two copies mean two separate class identities, two separate module-level caches, and two separate singletons. That is why you see errors like "instanceof failed" or "hook called outside provider" even though the types look fine.

Start by seeing the damage:

```bash
pnpm why <library>
```

That prints every package that depends on it and the version each one resolved to.

Then pick a fix.

**Align the ranges.** Bump whichever package is behind so both land on one compatible version. This is the real fix, and you should try it first.

**Force one version.** If you cannot bump, pin it in the root `package.json`:

```json
{
  "pnpm": {
    "overrides": {
      "<library>": "^5.2.0"
    }
  }
}
```

npm and yarn call this `overrides` and `resolutions`. Use it when you have checked that both packages actually work on the version you picked.

**Make it a peer dependency.** If the library must be a singleton, like React or a client SDK, the packages that use it should declare it as a `peerDependency`, not a `dependency`. That pushes the choice up to the app and stops duplicate copies for good.

Delete the lockfile and `node_modules` after any of these, then reinstall. Stale resolution is a common reason a correct fix looks broken.
