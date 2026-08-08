---
kind: eval-artifact
run: 3
variant: B
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Short version: your build isn't broken because of anything you did. The new package pulled in a second copy of a shared library at a different version, and now something in the tree is unhappy about which copy it gets.

**What's actually happening.** When two packages ask for different versions of the same dependency, the package manager has two options: pick one version that satisfies both, or install both copies side by side. If the version ranges overlap (say `^1.2.0` and `^1.5.0`), it picks one and everyone shares. If they don't overlap (`^1.x` vs `^2.x`), it installs both, and each package quietly gets its own copy.

Two copies is usually fine, until it isn't. It breaks when:

- **Types leak across the boundary.** Package A hands you a `Foo` from library v1, package B expects a `Foo` from v2. TypeScript sees these as different types even if the shape is identical, and you get errors that look nonsensical ("Type 'Foo' is not assignable to type 'Foo'").
- **The library holds state.** React, anything with a global registry, anything using `instanceof`. Two copies means two separate states, and checks that should pass start failing.
- **Bundle size balloons** because you're now shipping the library twice.

**How to find it.** Ask the package manager what it did:

```bash
pnpm why <library-name>
```

That prints every package depending on it and at what version. The two conflicting versions will be right there.

**How to fix it,** roughly in order of preference:

1. **Bump the older one.** If our package can move to the newer version, do that. Both packages converge on one copy and the problem disappears. This is the real fix.
2. **Ask the other team to align.** If the new package is the one on the odd version and it's ours, they may be able to move without much pain.
3. **Force a single version.** In pnpm, add a `resolutions`/`overrides` entry in the root `package.json` pinning the library to one version for the whole tree. This works, but it's a lie you're telling the package manager — you're asserting the pinned version is compatible with what both packages expect. Verify that's actually true, and leave a comment saying why the override exists.
4. **Make it a peer dependency.** If the library is something that genuinely must be a singleton, the packages should declare it as a peer dep rather than a regular one, so the app decides the version instead of each package bringing its own.

Option 3 is the tempting quick unblock. It's fine as a temporary measure, but it turns a build error into a possible runtime error, so don't leave it sitting there unexamined.

If you paste the `pnpm why` output I can tell you which of these applies.
