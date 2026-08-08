---
kind: eval-artifact
run: 3
variant: B
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly it won't, and it'll cost you readability for nothing. `useCallback` on its own doesn't stop a single re-render.

Here's why. By default, when a parent re-renders, React re-renders all its children — it doesn't compare props at all. A stable function identity is irrelevant because nothing is checking identity in the first place. `useCallback` only starts mattering when something downstream actually compares props, which means the child is wrapped in `React.memo`, or the function feeds a `useEffect` dependency array or another memoized hook.

So the rule is: **`useCallback` needs a partner.** Without `React.memo` on the child (or a dependency array consuming it), you're allocating a memo slot, storing the function, and running a dependency comparison every render — and then re-rendering the child anyway. That's strictly more work than passing a plain function.

And even paired with `memo`, it breaks easily. `memo` does a shallow prop comparison, so *every* prop has to be stable. One inline object or array undoes the whole thing:

```jsx
<Child onSave={handleSave} style={{ margin: 8 }} />
```

`handleSave` is stable, `style` is a fresh object every render, shallow comparison fails, child re-renders. All the `useCallback` work wasted. Same with `items={data ?? []}` — that `[]` is new each time. `children` is the subtle one: JSX children are new elements every render, so a `memo` component that takes children usually won't bail out at all.

**What I'd do instead:**

Don't optimize preemptively. Open React DevTools Profiler, record an interaction that feels slow, and look at what's actually expensive. Usually it's one or two components — a big list, a chart, something doing real work on render — and those are worth memoizing deliberately, `memo` and `useCallback` together, with the other props checked. Re-rendering a div with three spans in it costs nothing and is not worth a line of ceremony.

Two things that often beat memoization outright, worth trying first:

- **Move state down.** If the state lives closer to where it's used, the expensive subtree isn't in the re-render path at all.
- **Pass the expensive component as `children`.** Elements created in the grandparent don't re-render when the parent's state changes, because their element identity is unchanged. No `memo` needed.

Also worth knowing: if you're on React 19 with the compiler enabled, it inserts this memoization automatically and hand-written `useCallback` becomes largely redundant. Check whether that's on before doing the work by hand.
