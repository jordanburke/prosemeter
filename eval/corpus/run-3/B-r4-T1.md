---
kind: eval-artifact
run: 3
variant: B
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
What's happening: the new package pulls in a version of that library your package can't use alongside its own. Depending on the setup, the package manager either installed two copies (so you now have two separate instances of the same thing) or it collapsed them into one version that doesn't satisfy everyone.

Both failure modes are common:

- **Two copies installed.** Things that depend on a single shared instance break — instanceof checks fail, singletons get duplicated, "types are incompatible" errors show up even though the types look identical.
- **One copy installed.** Whichever package wanted the other version now gets an API that changed under it, so you see missing exports or runtime errors.

To find out which one you have, run `pnpm why <library>` from the repo root. That prints every package asking for it and the version each one got.

Fixing it, roughly in order of preference:

1. **Get everyone on the same version.** Usually the cleanest option — bump whoever is behind. If the newer version is backward compatible for the older consumer, this is a one-line change.
2. **Add an override.** If you can't change the other package quickly, pin the version in the root `package.json` under `pnpm.overrides`. This forces a single copy. Worth a real test pass afterward, because you're telling one package to use a version it didn't ask for.
3. **Make it a peer dependency.** If the library genuinely must be a single shared instance (the case for most React-adjacent and plugin-style libraries), declare it as a peer dep rather than a regular one. That way it's supplied once from the top instead of bundled by each package.

Option 1 if you can, option 2 if you're unblocking a build today. If you tell me which library it is I can look at what the two versions actually changed.
