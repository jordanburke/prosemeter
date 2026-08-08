---
kind: eval-artifact
run: 3
variant: B
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Nothing is wrong with your code — the new package pulled in a second copy of a shared library at a different version, and now the two copies are fighting.

Here's the shape of it. Your package wants `some-lib@^2`. Their new package wants `some-lib@^3`. The package manager can't satisfy both with one copy, so it installs both: one at the top level and one nested inside the new package. Most of the time that's harmless. It breaks when the library holds state that everyone is supposed to share, or when a type/instance from copy A gets handed to copy B. Classic symptoms:

- Type errors like `Type 'Foo' is not assignable to type 'Foo'` — same name, two different copies.
- `instanceof` checks failing on objects that clearly are that class.
- Anything with a registry or singleton (React, a DB driver, a validation library) behaving as if it was never initialized.

**To confirm it:**

```bash
pnpm why some-lib      # or: npm ls some-lib
```

If you see it listed at more than one version, that's your answer.

**To fix it, in the order I'd try:**

1. **Align the versions.** Bump whichever package is behind so both land on the same major. Cleanest fix, and usually a small change.
2. **If you can't bump yet**, force one copy with a pnpm `overrides` entry in the root `package.json`. This is a claim that the two versions are actually compatible — check the library's changelog before you make it, because if they aren't, you've traded a build error for a runtime bug.
3. **If the library is genuinely supposed to be shared** (React and friends), it should be a `peerDependency` in the packages that use it, not a regular `dependency`. That way there's one copy in the app and the packages just use whatever's there.

Rerunning the install after clearing `node_modules` and the lockfile entry is worth a shot too, but only after you've fixed the version constraint — otherwise you'll get the same tree back.
