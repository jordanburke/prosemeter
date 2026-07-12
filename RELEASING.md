# Releasing

All packages release together on one train (a changesets `fixed` group), so a
single version applies across the monorepo. Publishing uses npm OIDC trusted
publishing with provenance — no `NPM_TOKEN` secret.

## One-time setup (manual)

These steps happen once, outside CI:

1. Register the `@prosemeter` scope/org on npm and reserve the bare `prosemeter`
   name.
2. For each package, configure a **trusted publisher** on npmjs.com pointing at
   this repository and the `Publish` workflow. The **workflow filename must be
   `publish.yml`** (`.github/workflows/publish.yml`) with no environment — npm
   matches on that exact filename, so a mismatch fails every publish with `E404`.
3. Keep `.nvmrc` at Node 24 or newer. npm 10.x (Node 22) has an OIDC handshake
   bug; npm 11.5.1+ (Node 24) fixes it.

## Cutting a release

1. Add a changeset describing the change:

   ```bash
   pnpm changeset
   ```

   Because the group is `fixed`, one entry bumps every package.

2. Merge to `main`. The `Publish` workflow opens a "Version Packages" pull
   request that applies the version bump and updates changelogs.

3. Merge that pull request. The workflow then runs `pnpm release`, which builds
   every package and publishes with provenance.

## First publish (0.1.0)

The initial `0.1.0` has no changeset — the packages already carry that version.
Publish it once the one-time setup is done by running `pnpm release` from a clean
checkout, or by triggering the workflow. After that, use changesets for every
change.
