/**
 * Fail the release if a published version has no tarball.
 *
 * npm writes a version's metadata before its tarball lands. A publish that dies in between leaves
 * the version "staged": `registry.npmjs.org/<pkg>/<version>` answers 200 and
 * `<pkg>/-/<name>-<version>.tgz` answers 404. The version is then unusable *and* unwritable —
 * a later publish of the same number gets `E409: Cannot publish over previously staged version`.
 *
 * This happened on 0.5.0. `@prosemeter/style` staged, the other six published, and
 * `changeset publish` printed all seven under "Successfully published" and exited 0. Nothing was
 * red, and `prosemeter@0.5.0` shipped as `latest` requiring a dependency whose tarball 404s, so
 * `npm install prosemeter` was broken. Recovering cost two more version numbers.
 *
 * So: trust the tarball, not the exit code. Reads `publishedPackages` from changesets/action.
 *
 * It retries for three minutes, because propagation lag is normal and a slow tarball is not a
 * broken release. A failure here means "verify by hand before releasing again", not "this version
 * is lost" — on 0.5.0 every staged version completed on its own within about 25 minutes.
 */

const RETRIES = 12
const DELAY_MS = 15_000

/** `@scope/name` -> `@scope/name/-/name-1.2.3.tgz`; the filename drops the scope. */
const tarballUrl = (name, version) =>
  `https://registry.npmjs.org/${name}/-/${name.split("/").at(-1)}-${version}.tgz`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const raw = process.env.PUBLISHED_PACKAGES
if (raw === undefined || raw.trim() === "") {
  console.log("no publishedPackages in the environment — nothing to verify")
  process.exit(0)
}

const packages = JSON.parse(raw)
if (!Array.isArray(packages) || packages.length === 0) {
  console.log("publishedPackages is empty — nothing to verify")
  process.exit(0)
}

console.log(`verifying ${packages.length} tarball(s)`)

let pending = packages.map((p) => ({ ...p, url: tarballUrl(p.name, p.version) }))

for (let attempt = 1; attempt <= RETRIES && pending.length > 0; attempt++) {
  const still = []
  for (const p of pending) {
    // A HEAD is enough and avoids pulling megabytes per package.
    const res = await fetch(p.url, { method: "HEAD", redirect: "follow" }).catch((e) => ({
      ok: false,
      status: `fetch failed: ${e.message}`,
    }))
    if (res.ok) console.log(`  ok      ${p.name}@${p.version}`)
    else {
      console.log(`  missing ${p.name}@${p.version}  (${res.status}, attempt ${attempt}/${RETRIES})`)
      still.push(p)
    }
  }
  pending = still
  // Propagation is normally seconds. Retry so ordinary lag is not reported as a broken release.
  if (pending.length > 0 && attempt < RETRIES) await sleep(DELAY_MS)
}

if (pending.length > 0) {
  console.error("")
  console.error("::error::published versions have no tarball — the release is broken")
  for (const p of pending) console.error(`  ${p.name}@${p.version} -> ${p.url}`)
  console.error("")
  console.error("A retry of the same version may fail with E409 while npm holds it staged. That is")
  console.error("NOT proof the number is dead: observed on 0.5.0, every staged version completed on")
  console.error("its own within about 25 minutes. Re-check the tarballs above before cutting a new")
  console.error("version, and rule out the npm-version cause in RELEASING.md first.")
  process.exit(1)
}

console.log(`all ${packages.length} tarball(s) present`)
