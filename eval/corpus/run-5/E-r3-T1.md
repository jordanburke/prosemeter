---
kind: eval-artifact
run: 5
variant: E
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages ask for versions of the same library that cannot both be satisfied, and your package manager resolved to one of them.

Here is what happens under the hood. Each package declares a version range for its dependency. When the ranges overlap, the manager picks one copy that fits both. When they do not overlap, the manager either installs two copies at different places in the tree or, for a peer dependency, refuses and warns. Either outcome can break you.

Two copies break things when the library holds state or identity. Two copies of React mean two hook registries, so hooks throw. Two copies of a class mean `instanceof` returns false across the boundary. Two copies of a type package mean the compiler sees two unrelated types with the same name.

One copy breaks things when the winner is too old or too new for one of the packages. That package calls an API that moved or vanished, and you get a runtime error or a type error.

Find out which case you are in first. Run `npm ls <library>` or `pnpm why <library>` or `yarn why <library>`. The output shows every requester and the version each one got. If you see the library listed twice, you have duplicates. If you see one version and a package that wanted something else, you have a squeeze.

Then fix it one of these ways, cheapest first.

Upgrade the older package. Its newer release probably widened its range to include the version the new package wants. This is the right fix because it removes the conflict instead of hiding it.

Deduplicate if the ranges do already overlap. Run `npm dedupe` or `pnpm dedupe`. Lockfiles drift and keep stale duplicates around long after the ranges converged.

Force one version when you cannot upgrade. Use `overrides` in npm, `resolutions` in Yarn, or `pnpm.overrides`. This is a lie you tell the resolver, so leave a comment saying why and what to remove it for. Test the package you overrode.

Make the library a peer dependency if you own the packages. A peer says "I use this, but the app supplies it," which guarantees one copy. Bundlers can also alias the library to a single path.

Pin the shared library in your app's own dependencies as a last resort. That gives the resolver a strong hint but does not stop nested copies.

One warning about the override route. Forcing a version does not make the old package compatible; it just stops the installer complaining. If the API really changed, you moved a clear install error into a vague runtime one. Prefer the upgrade.
