---
kind: eval-artifact
run: 4
variant: A
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
This is the classic diamond dependency. Your package wants `lib@^2`, the new package wants `lib@^3`, and there's no single version that satisfies both, so the package manager installs two copies. Whether that's harmless or fatal depends on the library.

Start by confirming it:

```bash
pnpm why <lib>
```

That prints every path that pulls the library in and which version each one resolved to. If you see two version numbers, that's your answer.

Two copies breaks things in three common ways:

1. **Type errors.** TypeScript sees two structurally-similar-but-distinct declarations of the same type and refuses to unify them. The error usually looks nonsensical — "Type `Foo` is not assignable to type `Foo`" — which is the tell.
2. **Broken singletons.** If the library holds module-level state (a registry, a context, a plugin list, a `Symbol` used as a key), the two copies each get their own. Code that registers against copy A can't be found by copy B. React context and anything doing `instanceof` checks fail this way.
3. **Actual API incompatibility**, if the major bump genuinely removed something you use.

Fixes, roughly in order of how much I'd like them:

**Just align the versions.** If v3 is compatible with your usage, bump yours to `^3` and delete the duplicate. Cleanest outcome, no ongoing maintenance.

**Ask the other team to widen their range** if they don't actually need v3 features — `^2 || ^3` in their `package.json` lets pnpm dedupe to one copy.

**Force it with an override** if you're blocked now and need a bridge:

```json
{
  "pnpm": {
    "overrides": {
      "<lib>": "^3.0.0"
    }
  }
}
```

That's a real hammer — you're telling pnpm to lie to whichever package asked for the other range. Fine when the versions are compatible in practice, dangerous when they aren't. If you use it, leave a comment saying why and when it can come out.

**Make it a peer dependency** if the library is one of those singleton-ish things (a framework, a client, anything with module state). Then it's declared as "the app supplies exactly one of these" and duplication becomes a loud install-time warning rather than a silent runtime bug.

One thing worth checking before you pick: is the library legitimately safe to have two copies of? A pure utility like `date-fns` — sure, two copies, waste some bytes, move on. Anything stateful, and you want to actually resolve it rather than paper over it.
