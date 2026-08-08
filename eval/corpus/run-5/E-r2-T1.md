---
kind: eval-artifact
run: 5
variant: E
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and the resolver can only pick one for a given spot in the tree.

Here is what happens under the hood. Your package manager walks the dependency graph and tries to satisfy every version range with one shared copy. When the ranges overlap, it hoists a single version everyone uses. When they do not overlap, it either installs two copies in nested folders or picks one and leaves the other package running against a version it never expected.

Two failure shapes follow from that.

The first is a type or API error. One package calls a function the installed version dropped or renamed. The build fails at compile time, and the error names a symbol that looks like it should exist.

The second is the duplicate-instance bug, and it is nastier. Two copies of the library load at once. Anything that relies on shared module state breaks — `instanceof` checks fail, React hooks throw, singletons stop being single. The types check fine, so this one usually shows up at runtime.

Fix it in this order.

Find the conflict first. Run `npm ls <library>` or `pnpm why <library>` and read the tree it prints. That tells you which packages pull which ranges.

Then try aligning the ranges. Upgrade the older package to a release that accepts the newer library. This is the real fix, because it leaves one version in the tree and nothing pinned.

If no such release exists, force one version. npm and yarn call this `overrides` and `resolutions`; pnpm calls it `pnpm.overrides`. You are telling the resolver to ignore a declared range, so read the library's changelog for breaking changes between the two versions before you do it.

Move the library to a peer dependency if you own both packages. A peer dependency says "I use this, the app supplies it," which stops each package from installing its own copy.

Two things to watch. Add a comment next to any override saying which package forced it, or the next person will delete it and break the build again. And check whether the library ships dual ESM and CommonJS builds — if it does, you can load two copies of the same version through different entry points, which produces the duplicate-instance bug with no version conflict in sight.
