---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r2
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You have a version conflict. Two packages now want different versions of the same dependency, and your package manager can't satisfy both in one install.

Depending on the manager, one of two things happens. It either dedupes to a single version and one package silently gets code it wasn't tested against, or it installs both versions side by side (nested `node_modules`). The second case bites hardest with libraries that carry global state or use identity checks — React is the classic example. Two copies of React mean two separate hook dispatchers, and things like context or `instanceof` checks fail in strange ways.

To fix it:

1. Run `npm ls <package>` (or `pnpm why <package>`) to see who depends on which version.
2. Check if either package has a newer release that closes the gap — bumping the dependent is usually the cleanest fix.
3. If you can't bump either, pin the version with `overrides` (npm), `resolutions` (yarn), or `pnpm.overrides` in `package.json`.
4. After pinning, test both packages against the forced version — an override just picks a winner, it doesn't guarantee compatibility.

Start with step 1. The lockfile diff will usually tell you which package added the conflicting range.
