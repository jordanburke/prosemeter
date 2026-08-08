---
kind: eval-artifact
run: 3
variant: A
replicate: r5
task: T5
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Mostly no — and it'll cost you something for the trouble.

`useCallback` gives you a stable function *reference* across renders. That only prevents a re-render if the child is actually comparing props by reference before deciding to render. By default **it isn't**. A plain child component re-renders whenever its parent re-renders, full stop, regardless of whether its props changed. React doesn't bail out on equal props unless you tell it to.

So `useCallback` on its own does nothing for re-renders. It only pays off in combination with:

- `React.memo` on the child, or
- the function being a dependency of a `useEffect`/`useMemo`/another `useCallback`.

And the memo path has a second trap: `React.memo` does a shallow prop comparison, so **one** unstable prop defeats it entirely. If you stabilize `onClick` but still pass `style={{ margin: 8 }}` or `items={data.filter(...)}` inline, those are fresh objects every render and the memo comparison fails anyway. Your `useCallback` did no work. This is the single most common reason "I added useCallback and nothing changed."

What it costs, applied blanket-style:

- **It isn't free.** Every `useCallback` allocates the dependency array, and React stores and compares it on every render. For a cheap child, memoizing the callback is more work than just re-rendering the child would have been.
- **It's viral.** Stabilizing one thing exposes the next unstable prop, so you end up wrapping objects in `useMemo`, then their contents, and now the readability cost is spread across the whole file.
- **It rots.** A dep array that's wrong today is a stale-closure bug tomorrow — the callback captures old state and you get a subtle "why is it using the previous value" bug that's much harder to find than a re-render.

### What I'd suggest instead

**Measure first.** Open React DevTools Profiler, record an interaction, and look at what's actually expensive. Re-renders are cheap by default; React is designed around them being cheap. Most components can re-render hundreds of times a second without anyone noticing. The ones that hurt are usually big lists, heavy charts, or something doing real computation in the render body.

**Then memoize the specific thing that's slow**, child + callbacks + object props together as a unit. Memoization works as a matched set or not at all — half-applied, it's pure overhead.

**Often the better fix isn't memoization at all.** If a parent re-renders too often, look at *why* — state that lives higher than it needs to, a context whose value changes on every render, an effect setting state in a loop. Moving state down or splitting a context usually beats memoizing the whole subtree, and it doesn't rot.

Also worth knowing: if you're on React 19 with the compiler enabled, it inserts this memoization automatically and correctly, and hand-written `useCallback` becomes mostly redundant. Worth checking before investing in a manual pass.
