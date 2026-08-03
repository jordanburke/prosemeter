Your build fails because two packages ask for different versions of the same library.

**What is happening:** the bundler picks one version and hoists it. The package that wanted the other version still calls it, and the shapes no longer match. That is why the type error points at a file you never edited.

**The fix:** pin the library at the workspace root so every package resolves to one copy.

```bash
pnpm add -w zod@3.23.8
pnpm --filter core --filter api remove zod
pnpm install
```

**Why this works:** with one declaration left, the resolver has one candidate. There is nothing left to choose between, so the mismatch cannot come back the same way.

If it does come back, a new package brought its own copy. Check the lockfile first — the duplicate shows up as two entries under one name with different versions, which tells you who to fix.

One caveat: pinning at the root means a real upgrade now touches every consumer at once. That is the trade you are making for a single version.
