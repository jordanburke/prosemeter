---
kind: eval-artifact
run: 5
variant: L
replicate: r2
task: T5
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
It will not work on its own, and applied everywhere it will make the code slower and harder to read. `useCallback` only helps when the child is wrapped in `React.memo`, and only when every other prop is stable too.

Here is why. A child re-renders when its parent re-renders. That is the default, and prop identity has nothing to do with it. `React.memo` is what changes the rule: a memoized child skips its render when its props compare equal to last time. Without `memo`, a stable function prop changes nothing — the child re-renders anyway.

So `useCallback` alone buys nothing. `useCallback` plus `memo` buys something only if *all* the props are stable. One inline object, one inline array, one `style={{ margin: 8 }}` and the comparison fails, the child re-renders, and the `useCallback` was wasted.

`useCallback` also costs something. React stores the function and its dependency array, compares the deps on every render, and keeps the old closure alive. It is small, but it is not free, and it is a loss whenever the memoization does not pay.

The bigger cost is correctness. A wrong dependency array makes the callback capture a stale value, and the child calls it with data from three renders ago. That bug is real, and it is much worse than an extra render.

Ask three questions before reaching for it.

- **Is the child expensive?** A component rendering a few DOM nodes costs microseconds. React is fast at re-rendering. Most re-renders are not a problem worth solving.
- **Is the child wrapped in `memo`?** If not, start there or do nothing.
- **Are all the other props stable?** If not, fix those first, or the memo never hits.

Two cases genuinely need `useCallback` no matter the child. A function in another hook's dependency array — `useEffect`, `useMemo` — will retrigger that hook every render unless it is stable. And a function passed to a heavy virtualized list where thousands of rows compare props.

The right order is to measure first. Open the React DevTools Profiler, record an interaction, and find what actually takes time. Usually the answer is not the function props. It is state living too high in the tree, or a context value rebuilt on every render, or a list rendering every row when it should render a window.

Suggest this to them: fix the one slow path the profiler points at, and leave the rest alone.
