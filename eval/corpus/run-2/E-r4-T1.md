---
kind: eval-artifact
run: 2
variant: E
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and the package manager can only hoist one of them to the top of `node_modules`. Whichever version wins, the other package gets code it was not compiled against. That shows up as a type error, a missing export, or a runtime `undefined is not a function`.

**Find the conflict first:**

```bash
pnpm why <library-name>
```

That prints every package that depends on it and the version each one wants.

**Then pick one of three fixes, in order of preference:**

1. **Upgrade the lagging package.** If the older dependent has a newer release that accepts the new version, bump it. Both packages land on one version and the duplicate disappears. This is the only fix that actually resolves the disagreement.

2. **Widen the range.** If one package pins an exact version (`1.2.3` instead of `^1.2.3`), and the pin is not deliberate, loosen it so the resolver can pick a shared version.

3. **Force a single version.** Add a `pnpm.overrides` entry in the root `package.json`:

   ```json
   { "pnpm": { "overrides": { "<library-name>": "^2.0.0" } } }
   ```

   This tells the resolver to give everyone the same version, whether they asked for it or not. Use it as a stopgap. You are overruling a package's stated requirement, so test the overruled package before you ship.

One thing to check before you reach for any fix: does the library have to be a singleton? React, a state store, and anything holding module-level state break badly with two copies loaded, because each copy has its own registry. For those, deduping is mandatory. For a pure utility library, two copies are just wasted bytes, and you can leave the duplicate alone if deduping is painful.
