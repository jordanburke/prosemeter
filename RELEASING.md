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
3. Keep `.nvmrc` pinned to an **exact** Node version, currently `24.20.0`.

   A bare major is not enough. `actions/setup-node` resolves `24` to whatever 24.x
   the runner's tool cache happens to hold, and the bundled npm decides whether
   OIDC works at all. Observed on 2026-09-03, same workflow and same commit:

   | Node | npm | result |
   | --- | --- | --- |
   | 24.20.0 | 11.19.0 | published |
   | 24.19.0 | 11.17.0 | `E401 ... Failed to generate Web Auth URLs` |

   npm 11.17.0 abandons the token exchange and falls back to interactive browser
   login, which no runner can complete. npm 10.x (Node 22) has an older handshake
   bug of its own. Pinning the patch makes the publish credential deterministic,
   which matters more here than anywhere else in the repo: a failed publish cannot
   simply be retried.

4. **A publish that exits 0 is not proof the release landed.** npm writes a
   version's metadata before its tarball, so an interrupted publish leaves the
   version *staged* — `registry.npmjs.org/<pkg>/<version>` answers 200 while
   `<pkg>/-/<name>-<version>.tgz` answers 404. `changeset publish` prints such a
   package under "Successfully published" and exits 0.

   That shipped `prosemeter@0.5.0` as `latest` requiring `@prosemeter/style@^0.5.0`
   whose tarball 404'd, so `npm install prosemeter` failed while CI was green.
   `.github/scripts/verify-published-tarballs.mjs` now fetches every tarball after
   a publish and fails the job on a miss.

   **A staged version is usually not lost.** Retrying it returns
   `E409: Cannot publish over previously staged version`, which reads permanent and
   is not: on 0.5.0 every staged version completed on its own within about 25
   minutes. Re-check the tarball before cutting a replacement — cutting too early
   is how one bad publish became three consumed version numbers.

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
