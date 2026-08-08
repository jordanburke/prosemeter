---
kind: eval-artifact
run: 1
variant: D
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "Attributes a stale tree to aggressive pnpm resolution caching. pnpm re-resolves on overrides change and errors under --frozen-lockfile."
---
Short version: nothing is "broken" in the new package — you've just hit the point where the dependency tree can no longer collapse to one copy of that library, and something in your code assumed it could.

Here's the mechanic. Your package asks for `foo@^2.1.0`. The new package asks for `foo@^3.0.0`. Those ranges don't overlap, so the package manager does the only thing it can: it installs **both**, one at the top level and one nested under whichever package needed the odd version. Two copies, two module instances, both loaded at runtime.

That's usually fine — until it isn't, and it fails in one of three flavors:

1. **Type errors that look insane.** TypeScript sees `Foo` from copy A and `Foo` from copy B as *different types* even when they're structurally identical. You get "Type 'Foo' is not assignable to type 'Foo'". That's the tell.
2. **`instanceof` / singleton breakage.** If the library holds state — a registry, a plugin list, a context object, a connection pool — copy A's state is invisible to copy B. React, anything with a global cache, and most DI-ish libraries blow up this way.
3. **Peer dependency warnings that became errors.** If the library is declared as a peer dep somewhere, the resolver is now telling you it can't satisfy everyone with one version.

**How to figure out which version is where:**

```bash
pnpm why foo -r        # -r walks every workspace package
pnpm ls foo --depth=10
```

That prints the actual tree and tells you who is asking for what. Do this before you change anything — the fix depends on whether the conflict is direct (two of our packages) or transitive (something deep inside a third-party dep).

**The fixes, in order of preference:**

- **Actually align the versions.** If `foo@3` is backwards-compatible enough, bump your package to `^3.0.0` and be done. This is the real fix; everything below is a workaround.
- **Use a catalog** so the version lives in exactly one place. In `pnpm-workspace.yaml`:
  ```yaml
  catalog:
    foo: ^3.0.0
  ```
  and each package writes `"foo": "catalog:"`. Now a bump is a one-line change and drift can't come back.
- **Force one copy with an override** when you can't change the other team's package (or the conflict is buried in a transitive dep):
  ```json
  "pnpm": { "overrides": { "foo": "^3.0.0" } }
  ```
  This is a hammer. It says "everyone gets v3, I don't care what they asked for." If some package genuinely needed v2 APIs, you've traded a build error for a runtime error. Test it.
- **Leave both copies** if the library is genuinely stateless and it's only the type error biting you. Rare, but it happens with pure-function utility libs.

One more thing worth checking: if the library *must* be a single instance (React, a state store, an instrumentation SDK), it should be a `peerDependency` in your packages rather than a regular `dependency`. That pushes the version decision up to the app and makes this class of conflict a loud install-time warning instead of a weird runtime bug.

Delete `node_modules` and the lockfile entries after any of these — pnpm caches resolution aggressively and a stale lockfile will happily reproduce the old tree.
