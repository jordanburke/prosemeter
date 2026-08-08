---
kind: eval-artifact
run: 4
variant: A
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
What you're hitting is a version conflict in the dependency tree. Package A wants `some-lib@^2`, package B wants `some-lib@^4`, and the resolver can't satisfy both with one copy. Depending on your package manager you either get two copies installed (npm/yarn hoisting, nested `node_modules`) or a hard resolution error (pnpm is stricter).

Two copies is usually the worse outcome, because it fails in confusing ways rather than loudly:

- **`instanceof` breaks.** A class from copy 1 is not the same class object as copy 2, so type checks silently return false.
- **Singletons stop being single.** Anything with module-level state — a React context, a client registry, a DI container — now has two independent instances.
- **Types collide.** TypeScript sees two structurally similar but nominally distinct declarations and complains about assignability in places that look identical.

First thing to do is see the actual shape of it:

```bash
pnpm why some-lib     # or: npm ls some-lib
```

That prints every path in the tree that pulls it in and which version each one resolved to. Don't guess before you've run this — the package causing the break is often not the one you'd expect.

From there, roughly in order of preference:

1. **Bump the lagging dependency.** If package A has a newer release that accepts `^4`, upgrade it and the conflict disappears on its own. Cleanest fix, no ongoing maintenance.
2. **Make the library a peer dependency** if it's the singleton kind (React, a state library, an ORM client). Peer deps say "the app supplies this, I just use it," which forces one copy by construction. If you own package A or B, this is the right long-term shape.
3. **Force a single version** with a `resolutions` (yarn) or `overrides` (npm/pnpm) field. This works but you're overriding someone's declared compatibility range, so verify the older consumer actually runs against the newer version. It's a real fix if the range was overly conservative, and a landmine if there was a genuine breaking change.

Worth checking whether the library is one where duplication actually matters. Two copies of a pure utility library like `date-fns` costs you bundle size and nothing else. Two copies of anything holding state or identity is a correctness bug. Run `pnpm why` first and tell me what it prints — I can tell you which bucket you're in.
