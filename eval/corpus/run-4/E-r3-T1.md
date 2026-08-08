---
kind: eval-artifact
run: 4
variant: E
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because both versions of that library are now installed at once. Neither package is wrong on its own — they just can't agree.

pnpm gives each package its own copy when the version ranges don't overlap. So the tree holds `lib@2` under one package and `lib@3` under the other. TypeScript then sees two separate declarations of the same type and refuses to treat them as the same thing, which is almost certainly the error you're staring at. If the library holds state — a client, a registry, a React instance — you also get two live copies at runtime and the state splits between them.

Fix it by getting everyone onto one version:

1. Run `pnpm why <lib>` to see who pulls which version.
2. Bump or widen the range in whichever package is behind, so both resolve to the same version.
3. If you can't touch the other package, pin it from the root — add `pnpm.overrides` to the root `package.json` with `"<lib>": "3.4.1"`.
4. Re-run `pnpm install`, then `pnpm why <lib>` again. You want one entry, not two.

Overrides work, but treat them as a stopgap. They force a version the other package never tested against. Leave a comment saying why it's there, and drop it once that package catches up.
